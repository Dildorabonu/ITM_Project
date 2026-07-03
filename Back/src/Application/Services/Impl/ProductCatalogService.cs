using Application.DTOs;
using Application.DTOs.ProductCatalog;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ProductCatalogService : IProductCatalogService
{
    private readonly DatabaseContext _context;
    private readonly IActivityLogService _activityLogService;

    public ProductCatalogService(DatabaseContext context, IActivityLogService activityLogService)
    {
        _context = context;
        _activityLogService = activityLogService;
    }

    // Kanonik qidiruv — turli yozuvda (kirill/lotin, katta-kichik harf, probel) kiritilgan
    // so'rov ham topilishi uchun Name/Code va NameNormalized bo'yicha filtrlaydi.
    private static IQueryable<ProductCatalog> ApplySearch(IQueryable<ProductCatalog> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return query;
        var lower = search.ToLower();
        var norm = TextNormalizer.Normalize(search);
        return query.Where(p =>
            p.Name.ToLower().Contains(lower) ||
            p.Code.ToLower().Contains(lower) ||
            (norm != "" && p.NameNormalized.Contains(norm)));
    }

    public async Task<ApiResult<PagedResult<ProductCatalogResponseDto>>> GetAllAsync(int page, int pageSize, string? search)
    {
        var query = ApplySearch(_context.ProductCatalogs.AsNoTracking().Where(p => p.IsActive), search);

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(p => new ProductCatalogResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Unit = p.Unit,
                Description = p.Description,
                UsageCount = p.ContractProducts.Count,
                CreatedAt = p.CreatedAt,
            })
            .ToListAsync();

        var paged = PagedResult<ProductCatalogResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ProductCatalogResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<PagedResult<ProductCatalogResponseDto>>> LookupAsync(int page, int pageSize, string? search)
    {
        var query = ApplySearch(_context.ProductCatalogs.AsNoTracking().Where(p => p.IsActive), search);

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(p => new ProductCatalogResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Unit = p.Unit,
                Description = p.Description,
                CreatedAt = p.CreatedAt,
            })
            .ToListAsync();

        var paged = PagedResult<ProductCatalogResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ProductCatalogResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<ProductCatalogDetailDto>> GetDetailAsync(Guid id)
    {
        var product = await _context.ProductCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (product is null)
            return ApiResult<ProductCatalogDetailDto>.Failure(["Katalog mahsuloti topilmadi."], 404);

        // Shu katalog yozuviga bog'langan barcha shartnoma mahsulot qatorlari + shartnoma ma'lumotlari.
        var usages = await _context.ContractProducts
            .AsNoTracking()
            .Where(cp => cp.ProductCatalogId == id && cp.IsActive && cp.Contract != null)
            .Select(cp => new ProductCatalogContractUsageDto
            {
                ContractProductId = cp.Id,
                ContractId = cp.ContractId,
                ContractNo = cp.Contract!.ContractNo,
                ContractParty = cp.Contract.ContractParty,
                ContractType = cp.Contract.ContractType,
                ContractStatus = cp.Contract.Status,
                StartDate = cp.Contract.StartDate,
                EndDate = cp.Contract.EndDate,
                ContractIsActive = cp.Contract.IsActive,
                Quantity = cp.Quantity,
                Unit = cp.Unit,
                ProductStatus = cp.Status,
                ContractCreatedAt = cp.Contract.CreatedAt,
            })
            .ToListAsync();

        // Ishlab chiqarilgan miqdorlar — ManufacturedProduct.ProducedQuantity, mahsulot qatori bo'yicha yig'iladi.
        var productIds = usages.Select(u => u.ContractProductId).ToList();
        var producedByProduct = await _context.ManufacturedProducts
            .AsNoTracking()
            .Where(m => m.ContractProductId != null && productIds.Contains(m.ContractProductId.Value))
            .GroupBy(m => m.ContractProductId!.Value)
            .Select(g => new { ContractProductId = g.Key, Produced = g.Sum(x => x.ProducedQuantity) })
            .ToListAsync();
        var producedMap = producedByProduct.ToDictionary(x => x.ContractProductId, x => x.Produced);

        foreach (var u in usages)
            u.ProducedQuantity = producedMap.TryGetValue(u.ContractProductId, out var q) ? q : 0m;

        // Eng yangi shartnomalar birinchi.
        usages = usages.OrderByDescending(u => u.ContractCreatedAt).ToList();

        var statusBreakdown = usages
            .GroupBy(u => u.ProductStatus)
            .Select(g => new ProductCatalogStatusCountDto { Status = g.Key, Count = g.Count() })
            .OrderBy(s => s.Status)
            .ToList();

        var detail = new ProductCatalogDetailDto
        {
            Id = product.Id,
            Name = product.Name,
            Code = product.Code,
            Unit = product.Unit,
            Description = product.Description,
            CreatedAt = product.CreatedAt,
            ContractCount = usages.Select(u => u.ContractId).Distinct().Count(),
            ActiveContractCount = usages.Where(u => u.ContractIsActive).Select(u => u.ContractId).Distinct().Count(),
            TotalOrderedQuantity = usages.Sum(u => u.Quantity),
            TotalProducedQuantity = usages.Sum(u => u.ProducedQuantity),
            CompletedProductCount = usages.Count(u => u.ProductStatus == ContractProductStatus.Completed),
            StatusBreakdown = statusBreakdown,
            Contracts = usages,
        };

        return ApiResult<ProductCatalogDetailDto>.Success(detail);
    }

    public async Task<ApiResult<ProductCatalogResponseDto>> CreateAsync(ProductCatalogCreateDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<ProductCatalogResponseDto>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);

        var name = dto.Name.Trim();
        var normalized = TextNormalizer.Normalize(name);

        // Dublikat oldini olish — kanonik nom bo'yicha. Agar mavjud bo'lsa, xato o'rniga
        // mavjud yozuvni qaytaramiz (idempotent — frontend uni tanlab davom etadi).
        var existing = await _context.ProductCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.NameNormalized == normalized && p.IsActive);
        if (existing is not null)
            return ApiResult<ProductCatalogResponseDto>.Success(MapToResponse(existing), 200);

        var entity = new ProductCatalog
        {
            Id = Guid.NewGuid(),
            Name = name,
            NameNormalized = normalized,
            Code = await ProductCatalogCodeGenerator.NewUniqueAsync(_context),
            Unit = string.IsNullOrWhiteSpace(dto.Unit) ? null : dto.Unit.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsActive = true,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ProductCatalogs.Add(entity);
        await _context.SaveChangesAsync();

        await _activityLogService.LogAsync(
            kind: "product-catalog",
            title: $"Yangi katalog mahsuloti: {entity.Name}",
            subtitle: entity.Code,
            actorId: userId,
            refId: entity.Id);

        return ApiResult<ProductCatalogResponseDto>.Success(MapToResponse(entity), 201);
    }

    public async Task<ApiResult<ProductCatalogResponseDto>> UpdateAsync(Guid id, ProductCatalogUpdateDto dto)
    {
        var entity = await _context.ProductCatalogs.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (entity is null)
            return ApiResult<ProductCatalogResponseDto>.Failure(["Katalog mahsuloti topilmadi."], 404);

        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<ProductCatalogResponseDto>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);

        var name = dto.Name.Trim();
        var normalized = TextNormalizer.Normalize(name);

        // Boshqa yozuv shu kanonik nomni band qilganmi?
        var clash = await _context.ProductCatalogs
            .AnyAsync(p => p.Id != id && p.NameNormalized == normalized && p.IsActive);
        if (clash)
            return ApiResult<ProductCatalogResponseDto>.Failure([$"«{name}» nomli mahsulot allaqachon mavjud."]);

        entity.Name = name;
        entity.NameNormalized = normalized;
        entity.Unit = string.IsNullOrWhiteSpace(dto.Unit) ? null : dto.Unit.Trim();
        entity.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();

        await _context.SaveChangesAsync();

        return ApiResult<ProductCatalogResponseDto>.Success(MapToResponse(entity));
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var entity = await _context.ProductCatalogs.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null)
            return ApiResult<int>.Failure(["Katalog mahsuloti topilmadi."], 404);

        // FK SetNull — o'chirilsa, bog'langan shartnoma mahsulotlari ProductType (nom) matnini
        // saqlab qoladi, faqat bog'lanish uziladi. Shuning uchun to'g'ridan-to'g'ri o'chiramiz.
        _context.ProductCatalogs.Remove(entity);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static ProductCatalogResponseDto MapToResponse(ProductCatalog p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Code = p.Code,
        Unit = p.Unit,
        Description = p.Description,
        CreatedAt = p.CreatedAt,
    };
}
