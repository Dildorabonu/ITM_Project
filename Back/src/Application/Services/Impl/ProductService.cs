using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// "Korxona omborxonasi" servisi. Yirik mantiq qulaylik uchun partial fayllarga ajratilgan:
//   ProductService.cs              — asosiy CRUD (yaratish, tahrirlash, o'chirish, ro'yxat)
//   ProductService.Reservations.cs — muzlatilgan (rezerv) mahsulotlar ro'yxati
//   ProductService.Duplicates.cs   — nom o'xshashligi va dublikat tekshiruvi
public partial class ProductService : IProductService
{
    private readonly DatabaseContext _context;

    public ProductService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<PagedResult<ProductResponseDto>>> GetAllAsync(int page, int pageSize, string? search, Guid? departmentId, Guid? restrictToDepartmentId = null, DepartmentType? departmentType = null)
    {
        var query = _context.Products.AsNoTracking();

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

        // To'liq entity (QrCode, NameNormalized, ReservedQuantity + butun Department qatori)
        // o'rniga to'g'ridan-to'g'ri DTO ga proyeksiya — SQL faqat kerakli ustunlarni oladi.
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(p => new ProductResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                InvoiceNumber = p.InvoiceNumber,
                Description = p.Description,
                Quantity = p.Quantity,
                AvailableQuantity = p.Quantity - p.ReservedQuantity > 0m ? p.Quantity - p.ReservedQuantity : 0m,
                Unit = p.Unit,
                DepartmentId = p.DepartmentId,
                DepartmentName = p.Department!.Name,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        var paged = PagedResult<ProductResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ProductResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<int>> CreateAsync(ProductCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
            return ApiResult<int>.Failure(["Invoice raqami kiritilishi shart."]);

        if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

        if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

        // Kirill/lotin, katta-kichik harf, probel farqini hisobga olib aniq dublikatni to'samiz.
        var norm = TextNormalizer.Normalize(dto.Name);
        if (norm.Length >= 2 && await _context.Products.AnyAsync(p => p.NameNormalized == norm && p.DepartmentId == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Bu bo'limda '{dto.Name}' bilan bir xil (boshqacha yozilgan) mahsulot allaqachon mavjud."]);

        if (await _context.Products.AnyAsync(p => p.InvoiceNumber == dto.InvoiceNumber))
            return ApiResult<int>.Failure([$"Invoice raqami '{dto.InvoiceNumber}' allaqachon mavjud."]);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            NameNormalized = norm,
            InvoiceNumber = dto.InvoiceNumber.Trim(),
            QrCode = await ProductCodeGenerator.NewUniqueAsync(_context),
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

        if (list.Count == 0)
            return ApiResult<int>.Success(201);

        // Tekshiruv uchun kerak bo'lgan hamma narsa oldindan bir necha so'rovda olinadi.
        // Ilgari har bir qator uchun 4 ta so'rov ketardi (200 qatorga ~800 ta so'rov).
        var deptIds = list.Select(d => d.DepartmentId).Distinct().ToList();
        var names = list.Select(d => d.Name).Distinct().ToList();
        var norms = list.Select(d => TextNormalizer.Normalize(d.Name)).Where(n => n.Length >= 2).Distinct().ToList();
        var invoices = list.Select(d => (d.InvoiceNumber ?? string.Empty).Trim()).Where(i => i.Length > 0).Distinct().ToList();

        var knownDepts = (await _context.Departments
            .AsNoTracking()
            .Where(d => deptIds.Contains(d.Id))
            .Select(d => d.Id)
            .ToListAsync())
            .ToHashSet();

        // Faqat kiritilayotgan nom/normalized bilan to'qnashadigan qatorlar qaytadi.
        var clashing = await _context.Products
            .AsNoTracking()
            .Where(p => deptIds.Contains(p.DepartmentId) && (names.Contains(p.Name) || norms.Contains(p.NameNormalized)))
            .Select(p => new { p.DepartmentId, p.Name, p.NameNormalized })
            .ToListAsync();

        var takenNames = clashing.Select(p => (p.DepartmentId, p.Name)).ToHashSet();
        var takenNorms = clashing.Select(p => (p.DepartmentId, p.NameNormalized)).ToHashSet();

        // Invoice raqami butun baza bo'yicha unikal (bo'lim ahamiyatsiz).
        var takenInvoices = invoices.Count == 0
            ? new HashSet<string>()
            : (await _context.Products
                .AsNoTracking()
                .Where(p => invoices.Contains(p.InvoiceNumber))
                .Select(p => p.InvoiceNumber)
                .ToListAsync())
                .ToHashSet();

        var batchInvoices = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        // Fayl ichidagi (bo'lim + normalized nom) takrorlarini ushlash uchun.
        var batchNames = new HashSet<(Guid, string)>();
        foreach (var dto in list)
        {
            if (string.IsNullOrWhiteSpace(dto.InvoiceNumber))
                return ApiResult<int>.Failure([$"Mahsulot '{dto.Name}' uchun invoice raqami kiritilmagan."]);

            var inv = dto.InvoiceNumber.Trim();
            if (!batchInvoices.Add(inv))
                return ApiResult<int>.Failure([$"Invoice raqami '{inv}' ushbu yuborilgan ro'yxatda takrorlangan."]);

            if (!knownDepts.Contains(dto.DepartmentId))
                return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

            if (takenNames.Contains((dto.DepartmentId, dto.Name)))
                return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

            var norm = TextNormalizer.Normalize(dto.Name);
            if (norm.Length >= 2)
            {
                if (!batchNames.Add((dto.DepartmentId, norm)))
                    return ApiResult<int>.Failure([$"'{dto.Name}' bilan bir xil (boshqacha yozilgan) mahsulot ushbu ro'yxatda takrorlangan."]);

                if (takenNorms.Contains((dto.DepartmentId, norm)))
                    return ApiResult<int>.Failure([$"Bu bo'limda '{dto.Name}' bilan bir xil (boshqacha yozilgan) mahsulot allaqachon mavjud."]);
            }

            if (takenInvoices.Contains(inv))
                return ApiResult<int>.Failure([$"Invoice raqami '{inv}' allaqachon mavjud."]);
        }

        // Butun yuklama uchun QR kodlar bitta so'rovda tekshiriladi (har biri uchun alohida emas).
        var qrCodes = await ProductCodeGenerator.NewUniqueBatchAsync(_context, list.Count);

        var now = DateTime.UtcNow;
        var products = new List<Product>(list.Count);
        for (var i = 0; i < list.Count; i++)
        {
            var dto = list[i];
            products.Add(new Product
            {
                Id = Guid.NewGuid(),
                Name = dto.Name,
                NameNormalized = TextNormalizer.Normalize(dto.Name),
                InvoiceNumber = dto.InvoiceNumber.Trim(),
                QrCode = qrCodes[i],
                Description = dto.Description,
                Quantity = dto.Quantity,
                Unit = dto.Unit,
                DepartmentId = dto.DepartmentId,
                CreatedAt = now
            });
        }

        _context.Products.AddRange(products);
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
}
