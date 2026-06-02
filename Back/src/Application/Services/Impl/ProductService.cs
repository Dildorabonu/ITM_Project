using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ProductService : IProductService
{
    private readonly DatabaseContext _context;

    public ProductService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<PagedResult<ProductResponseDto>>> GetAllAsync(int page, int pageSize, string? search, Guid? departmentId, Guid? restrictToDepartmentId = null, DepartmentType? departmentType = null)
    {
        var query = _context.Products
            .Include(p => p.Department)
            .AsNoTracking();

        // Permission cheklov: agar foydalanuvchida Products.ViewAll yo'q bo'lsa,
        // faqat o'zining bo'limidagi mahsulotlar ko'rinadi.
        if (restrictToDepartmentId.HasValue)
            query = query.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        if (departmentType.HasValue)
            query = query.Where(p => p.Department!.Type == departmentType.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(lower) ||
                p.InvoiceNumber.ToLower().Contains(lower) ||
                (p.Description != null && p.Description.ToLower().Contains(lower)) ||
                p.Department!.Name.ToLower().Contains(lower));
        }

        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var paged = PagedResult<ProductResponseDto>.Create(items.Select(MapToResponse), totalCount, pagination);
        return ApiResult<PagedResult<ProductResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<PagedResult<ProductReservationDto>>> GetReservationsAsync(int page, int pageSize, string? search, Guid? restrictToDepartmentId = null)
    {
        // Rezerv hali "tirik" deb hisoblanadigan statuslar — Released yoki Rejected emas.
        var activeStatuses = new[]
        {
            RequisitionStatus.PendingApproval,
            RequisitionStatus.ReadyForWarehouseRelease
        };

        var query = _context.RequisitionItems
            .Include(i => i.ReservedProduct)
            .Include(i => i.Requisition).ThenInclude(r => r!.Department)
            .Where(i => i.ReservedProductId != null
                && i.Requisition != null
                && activeStatuses.Contains(i.Requisition.Status))
            .AsNoTracking();

        if (restrictToDepartmentId.HasValue)
            query = query.Where(i => i.ReservedProduct!.DepartmentId == restrictToDepartmentId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLower();
            query = query.Where(i =>
                i.ReservedProduct!.Name.ToLower().Contains(lower) ||
                i.ReservedProduct.InvoiceNumber.ToLower().Contains(lower) ||
                i.Requisition!.RequisitionNo.ToLower().Contains(lower) ||
                i.Requisition.Purpose.ToLower().Contains(lower) ||
                (i.Requisition.Department != null && i.Requisition.Department.Name.ToLower().Contains(lower)));
        }

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await query
            .OrderByDescending(i => i.Requisition!.WarehouseCheckedAt ?? i.Requisition.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var dtos = items.Select(i => new ProductReservationDto
        {
            ProductId = i.ReservedProduct!.Id,
            ProductName = i.ReservedProduct.Name,
            InvoiceNumber = i.ReservedProduct.InvoiceNumber,
            Unit = i.ReservedProduct.Unit,
            ReservedQuantity = i.Quantity,
            RequisitionId = i.Requisition!.Id,
            RequisitionNo = i.Requisition.RequisitionNo,
            Purpose = i.Requisition.Purpose,
            TargetDepartmentName = i.Requisition.Department?.Name,
            Status = i.Requisition.Status,
            StatusLabel = ReservationStatusLabel(i.Requisition.Status),
            WarehouseCheckedAt = i.Requisition.WarehouseCheckedAt
        });

        var paged = PagedResult<ProductReservationDto>.Create(dtos, totalCount, pagination);
        return ApiResult<PagedResult<ProductReservationDto>>.Success(paged);
    }

    private static string ReservationStatusLabel(RequisitionStatus s) => s switch
    {
        RequisitionStatus.PendingApproval          => "Tasdiqlash kutilmoqda",
        RequisitionStatus.ReadyForWarehouseRelease => "Chiqarish kutilmoqda",
        _                                          => s.ToString()
    };

    public async Task<ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>> GetDepartmentSummariesAsync(Guid? restrictToDepartmentId = null)
    {
        var deptQuery = _context.Departments.Where(d => d.IsActive).AsNoTracking();

        if (restrictToDepartmentId.HasValue)
            deptQuery = deptQuery.Where(d => d.Id == restrictToDepartmentId.Value);

        var depts = await deptQuery.OrderBy(d => d.Name).ToListAsync();
        if (depts.Count == 0)
            return ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>.Success([]);

        var deptIds = depts.Select(d => d.Id).ToList();
        var stats = await _context.Products
            .Where(p => deptIds.Contains(p.DepartmentId))
            .GroupBy(p => p.DepartmentId)
            .Select(g => new
            {
                DepartmentId = g.Key,
                ProductCount = g.Count(),
                TotalQuantity = g.Sum(p => p.Quantity)
            })
            .ToListAsync();

        var statMap = stats.ToDictionary(s => s.DepartmentId);

        var result = depts.Select(d =>
        {
            statMap.TryGetValue(d.Id, out var s);
            return new DepartmentWarehouseSummaryDto
            {
                DepartmentId = d.Id,
                DepartmentName = d.Name,
                DepartmentType = d.Type,
                ProductCount = s?.ProductCount ?? 0,
                TotalQuantity = s?.TotalQuantity ?? 0m
            };
        });

        return ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>.Success(result);
    }

    public async Task<ApiResult<IEnumerable<ProductResponseDto>>> GetByDepartmentAsync(Guid departmentId)
    {
        var products = await _context.Products
            .Include(p => p.Department)
            .Where(p => p.DepartmentId == departmentId)
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<ProductResponseDto>>.Success(products.Select(MapToResponse));
    }

    public async Task<ApiResult<ProductResponseDto>> GetByIdAsync(Guid id)
    {
        var product = await _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<ProductResponseDto>.Failure([$"Product with id '{id}' not found."]);

        return ApiResult<ProductResponseDto>.Success(MapToResponse(product));
    }

    // Berilgan nomga "o'xshash" mavjud mahsulotlarni topadi (pg_trgm similarity).
    // Maqsad: foydalanuvchi bir xil mahsulotni biroz boshqacha nom bilan (katta/kichik
    // harf, ortiqcha probel, bitta-ikki harf farqi) qayta kiritib yuborishining oldini olish.
    // Bloklamaydi — faqat ogohlantirish uchun ro'yxat qaytaradi.
    public async Task<ApiResult<IEnumerable<ProductSimilarDto>>> FindSimilarAsync(string name, Guid? departmentId, Guid? restrictToDepartmentId = null)
    {
        var term = name?.Trim() ?? string.Empty;
        if (term.Length < 2)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        // Kirill/lotin, katta-kichik harf, probel farqini yo'qotib taqqoslash uchun
        // kiritilgan nomni ham kanonik ko'rinishga keltiramiz.
        var normTerm = TextNormalizer.Normalize(term);
        if (normTerm.Length < 2)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        // 0..1 oralig'ida; pastroq qiymat ko'proq (shovqinli) natija beradi.
        const double threshold = 0.4;

        var query = _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .AsQueryable();

        // Mahsulot nomi takrorlanmasligi bo'lim ichida tekshiriladi, shuning uchun
        // o'xshashlikni ham tanlangan bo'lim doirasida qidiramiz.
        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        // Permission cheklovi: ViewAll yo'q foydalanuvchi faqat o'z bo'limini ko'radi.
        if (restrictToDepartmentId.HasValue)
            query = query.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        var matches = await query
            .Where(p => EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm) >= threshold)
            .OrderByDescending(p => EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm))
            .Take(5)
            .Select(p => new ProductSimilarDto
            {
                Id = p.Id,
                Name = p.Name,
                InvoiceNumber = p.InvoiceNumber,
                DepartmentId = p.DepartmentId,
                DepartmentName = p.Department!.Name,
                Similarity = EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm)
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ProductSimilarDto>>.Success(matches);
    }

    public async Task<ApiResult<int>> CreateAsync(ProductCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
            return ApiResult<int>.Failure(["Invoice raqami kiritilishi shart."]);

        if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

        if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

        if (await _context.Products.AnyAsync(p => p.InvoiceNumber == dto.InvoiceNumber))
            return ApiResult<int>.Failure([$"Invoice raqami '{dto.InvoiceNumber}' allaqachon mavjud."]);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            NameNormalized = TextNormalizer.Normalize(dto.Name),
            InvoiceNumber = dto.InvoiceNumber.Trim(),
            Description = dto.Description,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            DepartmentId = dto.DepartmentId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ProductCreateDto> dtos)
    {
        var list = dtos.ToList();

        if (list.Count > 200)
            return ApiResult<int>.Failure(["Bir vaqtda 200 tadan ortiq mahsulot qo'shib bo'lmaydi."]);

        var batchInvoices = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var dto in list)
        {
            if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
                return ApiResult<int>.Failure([$"Mahsulot '{dto.Name}' uchun invoice raqami kiritilmagan."]);

            var inv = dto.InvoiceNumber.Trim();
            if (!batchInvoices.Add(inv))
                return ApiResult<int>.Failure([$"Invoice raqami '{inv}' ushbu yuborilgan ro'yxatda takrorlangan."]);

            if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
                return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

            if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == dto.DepartmentId))
                return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

            if (await _context.Products.AnyAsync(p => p.InvoiceNumber == inv))
                return ApiResult<int>.Failure([$"Invoice raqami '{inv}' allaqachon mavjud."]);
        }

        var products = list.Select(dto => new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            NameNormalized = TextNormalizer.Normalize(dto.Name),
            InvoiceNumber = dto.InvoiceNumber.Trim(),
            Description = dto.Description,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            DepartmentId = dto.DepartmentId,
            CreatedAt = DateTime.UtcNow
        });

        await _context.Products.AddRangeAsync(products);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ProductUpdateDto dto)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<int>.Failure([$"Product with id '{id}' not found."]);

        if (dto.DepartmentId.HasValue && dto.DepartmentId.Value != product.DepartmentId)
        {
            if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value))
                return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

            product.DepartmentId = dto.DepartmentId.Value;
        }

        if (dto.Name is not null && dto.Name != product.Name)
        {
            var deptId = dto.DepartmentId ?? product.DepartmentId;
            if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == deptId))
                return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

            product.Name = dto.Name;
            product.NameNormalized = TextNormalizer.Normalize(dto.Name);
        }

        if (dto.InvoiceNumber is not null)
        {
            var inv = dto.InvoiceNumber.Trim();
            if (string.IsNullOrWhiteSpace(inv))
                return ApiResult<int>.Failure(["Invoice raqami bo'sh bo'lishi mumkin emas."]);

            if (inv != product.InvoiceNumber)
            {
                if (await _context.Products.AnyAsync(p => p.InvoiceNumber == inv && p.Id != id))
                    return ApiResult<int>.Failure([$"Invoice raqami '{inv}' allaqachon mavjud."]);

                product.InvoiceNumber = inv;
            }
        }

        if (dto.Description is not null) product.Description = dto.Description;
        if (dto.Quantity.HasValue) product.Quantity = dto.Quantity.Value;
        if (dto.Unit.HasValue) product.Unit = dto.Unit.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<int>.Failure([$"Product with id '{id}' not found."]);

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static ProductResponseDto MapToResponse(Product product) => new()
    {
        Id = product.Id,
        Name = product.Name,
        InvoiceNumber = product.InvoiceNumber,
        Description = product.Description,
        Quantity = product.Quantity,
        AvailableQuantity = Math.Max(0m, product.Quantity - product.ReservedQuantity),
        Unit = product.Unit,
        DepartmentId = product.DepartmentId,
        DepartmentName = product.Department?.Name ?? string.Empty,
        CreatedAt = product.CreatedAt
    };
}
