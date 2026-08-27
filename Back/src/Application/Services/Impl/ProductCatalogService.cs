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

    // Faol katalog yozuvlari ustidan sahifalangan so'rov — ro'yxat va lookup faqat
    // qaytariladigan maydonlari bilan farq qiladi, qolgan mantiq bir xil.
    private async Task<ApiResult<PagedResult<TDto>>> PageAsync<TDto>(
        int page, int pageSize, string? search,
        Func<IQueryable<ProductCatalog>, IQueryable<TDto>> project)
    {
        var query = ApplySearch(_context.ProductCatalogs.AsNoTracking().Where(p => p.IsActive), search);

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await project(query
                .OrderBy(p => p.Name)
                .Skip((pagination.Page - 1) * pagination.PageSize)
                .Take(pagination.PageSize))
            .ToListAsync();

        return ApiResult<PagedResult<TDto>>.Success(PagedResult<TDto>.Create(items, totalCount, pagination));
    }

    public Task<ApiResult<PagedResult<ProductCatalogResponseDto>>> GetAllAsync(int page, int pageSize, string? search)
        => PageAsync(page, pageSize, search, q => q.Select(p => new ProductCatalogResponseDto
        {
            Id = p.Id,
            Name = p.Name,
            Code = p.Code,
            Unit = p.Unit,
            Description = p.Description,
            UsageCount = p.ContractProducts.Count,
        }));

    public Task<ApiResult<PagedResult<ProductCatalogLookupDto>>> LookupAsync(int page, int pageSize, string? search)
        => PageAsync(page, pageSize, search, q => q.Select(p => new ProductCatalogLookupDto
        {
            Id = p.Id,
            Name = p.Name,
            Code = p.Code,
            Unit = p.Unit,
        }));

    // Shartnoma qatori + faqat agregatlar uchun kerak bo'lgan ContractId (javobga chiqmaydi).
    private sealed record UsageRow(Guid ContractId, ProductCatalogContractUsageDto Dto);

    public async Task<ApiResult<ProductCatalogDetailDto>> GetDetailAsync(Guid id)
    {
        var detail = await _context.ProductCatalogs
            .AsNoTracking()
            .Where(p => p.Id == id && p.IsActive)
            .Select(p => new ProductCatalogDetailDto
            {
                Name = p.Name,
                Code = p.Code,
                Unit = p.Unit,
                Description = p.Description,
            })
            .FirstOrDefaultAsync();
        if (detail is null)
            return ApiResult<ProductCatalogDetailDto>.Failure(["Katalog mahsuloti topilmadi."], 404);

        // Shu katalog yozuviga bog'langan mahsulot qatorlari — eng yangi shartnoma birinchi.
        // Ishlab chiqarilgan miqdor ManufacturedProduct bilan 1:1 (ContractProductId noyob
        // indeks), shuning uchun alohida so'rov o'rniga ichki so'rov bilan olinadi.
        var rows = await _context.ContractProducts
            .AsNoTracking()
            .Where(cp => cp.ProductCatalogId == id && cp.IsActive && cp.Contract != null)
            .OrderByDescending(cp => cp.Contract!.CreatedAt)
            .Select(cp => new UsageRow(cp.ContractId, new ProductCatalogContractUsageDto
            {
                ContractProductId = cp.Id,
                ContractNo = cp.Contract!.ContractNo,
                ContractParty = cp.Contract.ContractParty,
                ContractType = cp.Contract.ContractType,
                StartDate = cp.Contract.StartDate,
                EndDate = cp.Contract.EndDate,
                ContractIsActive = cp.Contract.IsActive,
                Quantity = cp.Quantity,
                Unit = cp.Unit,
                ProductStatus = cp.Status,
                ProducedQuantity = _context.ManufacturedProducts
                    .Where(m => m.ContractProductId == cp.Id)
                    .Select(m => m.ProducedQuantity)
                    .FirstOrDefault(),
            }))
            .ToListAsync();

        var usages = rows.Select(r => r.Dto).ToList();
        if (usages.Count > 0)
            await AttachResourcesAsync(usages);

        detail.ContractCount = rows.Select(r => r.ContractId).Distinct().Count();
        detail.ActiveContractCount = rows
            .Where(r => r.Dto.ContractIsActive)
            .Select(r => r.ContractId)
            .Distinct()
            .Count();
        detail.TotalOrderedQuantity = usages.Sum(u => u.Quantity);
        detail.TotalProducedQuantity = usages.Sum(u => u.ProducedQuantity);
        detail.CompletedProductCount = usages.Count(u => u.ProductStatus == ContractProductStatus.Completed);
        detail.StatusBreakdown = usages
            .GroupBy(u => u.ProductStatus)
            .Select(g => new ProductCatalogStatusCountDto { Status = g.Key, Count = g.Count() })
            .OrderBy(s => s.Status)
            .ToList();
        detail.Contracts = usages;

        return ApiResult<ProductCatalogDetailDto>.Success(detail);
    }

    // Bazadan keladigan yengil qatorlar — tartiblash ham, filtrlash ham so'rov ichida
    // bajariladi, shuning uchun CreatedAt kabi maydonlar umuman o'qilmaydi.
    private sealed record ResourceRow(Guid CpId, Guid Id, string Title, int Status, int? MetaValue);
    private sealed record TaskRow(Guid CpId, ProductCatalogTaskDto Task);

    // Mahsulot qatorlariga biriktirilgan hujjatlar (tex jarayon, chizma, me'yoriy sarf)
    // va vazifalarni yuklab, ContractProductId bo'yicha tarqatadi.
    private async System.Threading.Tasks.Task AttachResourcesAsync(List<ProductCatalogContractUsageDto> usages)
    {
        var productIds = usages.Select(u => u.ContractProductId).ToList();

        var techMap = await ResourceMapAsync(_context.TechProcesses
            .AsNoTracking()
            .Where(x => x.ContractProductId != null && productIds.Contains(x.ContractProductId.Value) && x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResourceRow(
                x.ContractProductId!.Value, x.Id, x.Title, (int)x.Status, x.CurrentStep)));

        var drawingMap = await ResourceMapAsync(_context.TechnicalDrawings
            .AsNoTracking()
            .Where(x => x.ContractProductId != null && productIds.Contains(x.ContractProductId.Value) && x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResourceRow(
                x.ContractProductId!.Value, x.Id, x.Title, (int)x.Status, null)));

        var normMap = await ResourceMapAsync(_context.CostNorms
            .AsNoTracking()
            .Where(x => x.ContractProductId != null && productIds.Contains(x.ContractProductId.Value) && x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResourceRow(
                x.ContractProductId!.Value, x.Id, x.Title, (int)x.Status,
                x.Items.Count(i => i.IsActive && !i.IsSection))));

        var taskRows = await _context.ContractTasks
            .AsNoTracking()
            .Where(x => x.ContractProductId != null && productIds.Contains(x.ContractProductId.Value) && x.IsActive)
            .OrderBy(x => x.OrderNo)
            .Select(x => new TaskRow(x.ContractProductId!.Value, new ProductCatalogTaskDto
            {
                Id = x.Id,
                OrderNo = x.OrderNo,
                Name = x.Name,
                CompletedAmount = x.CompletedAmount,
                TotalAmount = x.TotalAmount,
                Importance = x.Importance,
            }))
            .ToListAsync();
        var taskMap = taskRows
            .GroupBy(x => x.CpId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Task).ToList());

        foreach (var u in usages)
        {
            u.TechProcesses = techMap.TryGetValue(u.ContractProductId, out var tp) ? tp : [];
            u.Drawings = drawingMap.TryGetValue(u.ContractProductId, out var dr) ? dr : [];
            u.CostNorms = normMap.TryGetValue(u.ContractProductId, out var cn) ? cn : [];
            u.Tasks = taskMap.TryGetValue(u.ContractProductId, out var tk) ? tk : [];
        }
    }

    // GroupBy xotirada — bazadan kelgan tartib saqlanadi. MetaValue 0 bo'lsa
    // yuborilmaydi (frontend uni "yo'q" deb talqin qiladi).
    private static async Task<Dictionary<Guid, List<ProductCatalogResourceDto>>> ResourceMapAsync(
        IQueryable<ResourceRow> query)
        => (await query.ToListAsync())
            .GroupBy(x => x.CpId)
            .ToDictionary(g => g.Key, g => g.Select(x => new ProductCatalogResourceDto
            {
                Id = x.Id,
                Title = x.Title,
                Status = x.Status,
                MetaValue = x.MetaValue > 0 ? x.MetaValue : null,
            }).ToList());

    public async Task<ApiResult<ProductCatalogResponseDto>> CreateAsync(ProductCatalogCreateDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<ProductCatalogResponseDto>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);

        // Birlik majburiy — shartnoma mahsuloti uni katalogdan oladi va o'zgartira olmaydi.
        if (string.IsNullOrWhiteSpace(dto.Unit))
            return ApiResult<ProductCatalogResponseDto>.Failure(["O'lchov birligini tanlang."]);

        var name = dto.Name.Trim();
        var normalized = TextNormalizer.Normalize(name);

        // Dublikat oldini olish — kanonik nom bo'yicha. Agar mavjud bo'lsa, xato o'rniga
        // mavjud yozuvni qaytaramiz (idempotent — frontend uni tanlab davom etadi).
        var existing = await _context.ProductCatalogs
            .AsNoTracking()
            .Where(p => p.NameNormalized == normalized && p.IsActive)
            .Select(p => new ProductCatalogResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Unit = p.Unit,
                Description = p.Description,
            })
            .FirstOrDefaultAsync();
        if (existing is not null)
            return ApiResult<ProductCatalogResponseDto>.Success(existing, 200);

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
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<ProductCatalogResponseDto>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);

        // Birlik majburiy — shartnoma mahsuloti uni katalogdan oladi va o'zgartira olmaydi.
        if (string.IsNullOrWhiteSpace(dto.Unit))
            return ApiResult<ProductCatalogResponseDto>.Failure(["O'lchov birligini tanlang."]);

        var entity = await _context.ProductCatalogs.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
        if (entity is null)
            return ApiResult<ProductCatalogResponseDto>.Failure(["Katalog mahsuloti topilmadi."], 404);

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

    public async Task<ApiResult<bool>> DeleteAsync(Guid id)
    {
        // FK SetNull — o'chirilsa, bog'langan shartnoma mahsulotlari ProductType (nom) matnini
        // saqlab qoladi, faqat bog'lanish uziladi. Shuning uchun to'g'ridan-to'g'ri o'chiramiz.
        var removed = await _context.ProductCatalogs.Where(p => p.Id == id).ExecuteDeleteAsync();
        if (removed == 0)
            return ApiResult<bool>.Failure(["Katalog mahsuloti topilmadi."], 404);

        return ApiResult<bool>.Success(true);
    }

    // Yangi/tahrirlangan yozuv javobi — hozirgina yaratilganda UsageCount har doim 0,
    // tahrirlashda esa bog'lanishlar soni o'zgarmaydi, shuning uchun so'rov qilinmaydi.
    private static ProductCatalogResponseDto MapToResponse(ProductCatalog p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Code = p.Code,
        Unit = p.Unit,
        Description = p.Description,
    };
}
