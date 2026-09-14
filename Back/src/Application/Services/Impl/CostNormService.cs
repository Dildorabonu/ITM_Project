using System.Text.Json;
using Application.DTOs;
using Application.DTOs.CostNorms;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using SysTask = System.Threading.Tasks.Task;

namespace Application.Services.Impl;

public class CostNormService : ICostNormService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IAttachmentService _attachmentService;
    private readonly IManufacturedProductService _manufacturedProductService;

    public CostNormService(
        DatabaseContext context,
        INotificationService notificationService,
        IAttachmentService attachmentService,
        IManufacturedProductService manufacturedProductService)
    {
        _context = context;
        _notificationService = notificationService;
        _attachmentService = attachmentService;
        _manufacturedProductService = manufacturedProductService;
    }

    public async Task<ApiResult<IEnumerable<CostNormListItemDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null, bool? isActive = null)
    {
        var query = _context.CostNorms.AsNoTracking();

        if (!viewAll && !contractId.HasValue)
        {
            // Bo'lim tekshiruvi ilgari har bir qator uchun Users jadvaliga korrelyatsion
            // so'rov qilar edi — endi foydalanuvchi bo'limi bir marta olinadi.
            var userDepartmentId = await _context.Users
                .Where(u => u.Id == currentUserId)
                .Select(u => u.DepartmentId)
                .FirstOrDefaultAsync();

            query = query.Where(c =>
                _context.ContractUsers.Any(cu => cu.ContractId == c.ContractId && cu.UserId == currentUserId) ||
                (userDepartmentId != null &&
                    _context.ContractDepartments.Any(cd => cd.ContractId == c.ContractId && cd.DepartmentId == userDepartmentId)) ||
                (c.ContractProductId != null && (
                    _context.ContractProductUsers.Any(pu => pu.ContractProductId == c.ContractProductId && pu.UserId == currentUserId) ||
                    (userDepartmentId != null &&
                        _context.ContractProductDepartments.Any(pd => pd.ContractProductId == c.ContractProductId && pd.DepartmentId == userDepartmentId))
                )));
        }

        if (contractId.HasValue)
            query = query.Where(c => c.ContractId == contractId.Value);

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        // To'g'ridan-to'g'ri DTO ga proyeksiya — Contract/ContractProduct entity'lari
        // va MetadataJson bloki umuman yuklanmaydi, faqat kerakli ustunlar SQL dan olinadi.
        var list = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new CostNormListItemDto
            {
                Id = c.Id,
                ContractNo = c.Contract != null ? c.Contract.ContractNo : string.Empty,
                ContractProductId = c.ContractProductId,
                ProductType = c.ContractProduct != null ? c.ContractProduct.ProductType : null,
                ContractQuantity = c.ContractProduct != null && c.ContractProduct.Quantity > 0 ? c.ContractProduct.Quantity : 1,
                Title = c.Title,
                Notes = c.Notes,
                Status = c.Status,
                IsActive = c.IsActive,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<CostNormListItemDto>>.Success(list);
    }

    public async Task<ApiResult<CostNormResponseDto>> GetByIdAsync(Guid id)
    {
        var costNorm = await _context.CostNorms
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CostNormResponseDto
            {
                Id = c.Id,
                ContractNo = c.Contract != null ? c.Contract.ContractNo : string.Empty,
                ContractProductId = c.ContractProductId,
                ProductType = c.ContractProduct != null ? c.ContractProduct.ProductType : null,
                ContractQuantity = c.ContractProduct != null && c.ContractProduct.Quantity > 0 ? c.ContractProduct.Quantity : 1,
                Title = c.Title,
                Notes = c.Notes,
                Status = c.Status,
                IsActive = c.IsActive,
                Items = c.Items
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new CostNormItemResponseDto
                    {
                        IsSection = i.IsSection,
                        SectionName = i.SectionName,
                        No = i.No,
                        Name = i.Name,
                        Unit = i.Unit,
                        ReadyQty = i.ReadyQty,
                        WasteQty = i.WasteQty,
                        TotalQty = i.TotalQty,
                        PhotoRaw = i.PhotoRaw,
                        PhotoSemi = i.PhotoSemi,
                        ImportType = i.ImportType,
                        SortOrder = i.SortOrder,
                        DepartmentId = i.DepartmentId,
                        DepartmentName = i.Department != null ? i.Department.Name : null,
                    })
                    .ToList(),
            })
            .FirstOrDefaultAsync();

        if (costNorm is null)
            return ApiResult<CostNormResponseDto>.Failure([$"CostNorm with id '{id}' not found."], 404);

        return ApiResult<CostNormResponseDto>.Success(costNorm);
    }

    public async Task<ApiResult<Guid>> CreateAsync(CostNormCreateDto dto, Guid createdBy)
    {
        // Mavjudlik tekshiruvi va bildirishnomada ishlatiladigan shartnoma raqami — bitta so'rovda.
        var contractNo = await _context.Contracts
            .Where(c => c.Id == dto.ContractId)
            .Select(c => c.ContractNo)
            .FirstOrDefaultAsync();

        if (contractNo is null)
            return ApiResult<Guid>.Failure([$"Contract with id '{dto.ContractId}' not found."], 404);

        if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (!productOk)
                return ApiResult<Guid>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        var costNorm = new CostNorm
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            Title = dto.Title,
            Notes = dto.Notes,
            MetadataJson = SerializeMetadata(dto.Metadata),
            Status = DrawingStatus.InProgress,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            Items = BuildItems(dto.Items, null)
        };

        _context.CostNorms.Add(costNorm);
        await _context.SaveChangesAsync();

        await RegenerateDocxAsync(costNorm, createdBy);

        // Shartnoma a'zolari + biriktirilgan bo'lim xodimlari: entity grafini
        // yuklamasdan, bitta so'rovda faqat ID lar.
        var recipientIds = await _context.ContractUsers
            .Where(cu => cu.ContractId == dto.ContractId)
            .Select(cu => cu.UserId)
            .Union(_context.Users
                .Where(u => u.IsActive && u.DepartmentId != null &&
                    _context.ContractDepartments.Any(cd => cd.ContractId == dto.ContractId && cd.DepartmentId == u.DepartmentId))
                .Select(u => u.Id))
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            recipientIds,
            $"Yangi me'yoriy sarf: {costNorm.Title}",
            $"«{contractNo}» shartnomasi uchun me'yoriy sarf norma tuzildi: {costNorm.Title}. Materiallar: {costNorm.Items.Count} ta.",
            NotificationType.Info,
            dto.ContractId);

        return ApiResult<Guid>.Success(costNorm.Id, 201);
    }

    // Section qatoridagi DepartmentId undan keyingi oddiy qatorlarga (keyingi
    // section'gacha) ko'chiriladi — bo'lim kesimidagi sarf so'rovlari SortOrder
    // logikasisiz to'g'ridan-to'g'ri DepartmentId bo'yicha guruhlash bilan ishlaydi.
    private static List<CostNormItem> BuildItems(IEnumerable<CostNormItemCreateDto> items, Guid? costNormId)
    {
        Guid? currentDept = null;
        return items.Select((item, index) =>
        {
            if (item.IsSection) currentDept = item.DepartmentId;
            return new CostNormItem
            {
                Id = Guid.NewGuid(),
                CostNormId = costNormId ?? Guid.Empty,
                IsSection = item.IsSection,
                SectionName = item.SectionName,
                No = item.No,
                Name = item.Name,
                Unit = item.Unit,
                ReadyQty = item.ReadyQty,
                WasteQty = item.WasteQty,
                TotalQty = item.TotalQty,
                PhotoRaw = item.PhotoRaw,
                PhotoSemi = item.PhotoSemi,
                ImportType = item.ImportType,
                SortOrder = item.SortOrder > 0 ? item.SortOrder : index,
                DepartmentId = item.IsSection ? item.DepartmentId : currentDept,
            };
        }).ToList();
    }

    // After a CN approval, a single product may now have both TP+CN approved
    // and can move to InProduction independently of its siblings.
    private async SysTask AdvanceProductIfReadyAsync(Guid? productId)
    {
        if (!productId.HasValue) return;

        var product = await _context.ContractProducts.FirstOrDefaultAsync(p => p.Id == productId.Value);
        if (product is null) return;
        if (product.Status == ContractProductStatus.InProduction
            || product.Status == ContractProductStatus.Completed
            || product.Status == ContractProductStatus.Cancelled)
            return;

        if (!await ContractStatusHelper.IsProductReadyForProductionAsync(_context, product.Id))
            return;

        product.Status = ContractProductStatus.InProduction;
        await _context.SaveChangesAsync();
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, CostNormUpdateDto dto)
    {
        // Items faqat ular almashtirilganda kerak — har safar Include qilib yuklamaymiz.
        var costNorm = await _context.CostNorms.FirstOrDefaultAsync(c => c.Id == id);

        if (costNorm is null)
            return ApiResult<int>.Failure([$"CostNorm with id '{id}' not found."], 404);

        if (dto.Title is not null) costNorm.Title = dto.Title;
        if (dto.Notes is not null) costNorm.Notes = dto.Notes;
        if (dto.Metadata is not null) costNorm.MetadataJson = SerializeMetadata(dto.Metadata);

        if (dto.ClearContractProduct)
        {
            costNorm.ContractProductId = null;
        }
        else if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == costNorm.ContractId);
            if (!productOk)
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
            costNorm.ContractProductId = dto.ContractProductId.Value;
        }

        List<CostNormItem>? newItems = null;
        if (dto.Items is not null)
        {
            // Eski qatorlarni o'chirish uchun ularni xotiraga yuklash shart emas.
            await _context.CostNormItems
                .Where(i => i.CostNormId == costNorm.Id)
                .ExecuteDeleteAsync();

            newItems = BuildItems(dto.Items, costNorm.Id);
            await _context.CostNormItems.AddRangeAsync(newItems);
        }

        await _context.SaveChangesAsync();

        // DOCX generatori costNorm.Items ni o'qiydi: qatorlar almashtirilgan bo'lsa
        // ular allaqachon xotirada, aks holda saqlangan qatorlar o'qiladi.
        costNorm.Items = newItems is not null
            ? newItems.OrderBy(i => i.SortOrder).ToList()
            : await _context.CostNormItems
                .Where(i => i.CostNormId == costNorm.Id)
                .OrderBy(i => i.SortOrder)
                .AsNoTracking()
                .ToListAsync();

        await RegenerateDocxAsync(costNorm, costNorm.CreatedBy);

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> ApproveAsync(Guid id)
    {
        var costNorm = await _context.CostNorms.FirstOrDefaultAsync(c => c.Id == id);
        if (costNorm is null)
            return ApiResult<int>.Failure([$"CostNorm with id '{id}' not found."], 404);

        if (costNorm.Status == DrawingStatus.Approved)
            return ApiResult<int>.Failure(["Me'yoriy sarf allaqachon tasdiqlangan."]);

        costNorm.Status = DrawingStatus.Approved;
        await _context.SaveChangesAsync();
        await AdvanceProductIfReadyAsync(costNorm.ContractProductId);
        await ContractStatusHelper.RecomputeContractStatusAsync(_context, costNorm.ContractId);
        await _context.SaveChangesAsync();
        await _manufacturedProductService.SyncForContractAsync(costNorm.ContractId);
        return ApiResult<int>.Success(1);
    }

    // DB rows are the source of truth; the attachment is a generated artifact we
    // rebuild on every Create/Update so the file always matches the latest items.
    private async SysTask RegenerateDocxAsync(CostNorm costNorm, Guid uploaderId)
    {
        await _attachmentService.DeleteAllAsync("costnorm", costNorm.Id);

        var contract = await _context.Contracts
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == costNorm.ContractId);
        var product = costNorm.ContractProductId.HasValue
            ? await _context.ContractProducts
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == costNorm.ContractProductId.Value)
            : null;

        var metadata = DeserializeMetadata(costNorm.MetadataJson);
        var bytes = CostNormDocxGenerator.Generate(costNorm, contract, product, metadata);
        var fileName = CostNormDocxGenerator.BuildFileName(costNorm.Title);
        using var stream = new MemoryStream(bytes);
        await _attachmentService.UploadAsync(
            "costnorm",
            costNorm.Id,
            stream,
            fileName,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            bytes.Length,
            uploaderId);
    }

    private static readonly JsonSerializerOptions MetadataJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private static string? SerializeMetadata(CostNormMetadataDto? metadata)
    {
        if (metadata is null) return null;
        return JsonSerializer.Serialize(metadata, MetadataJsonOptions);
    }

    private static CostNormMetadataDto? DeserializeMetadata(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<CostNormMetadataDto>(json, MetadataJsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
