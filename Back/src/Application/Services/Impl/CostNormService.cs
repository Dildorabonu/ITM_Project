using System.Text.Json;
using Application.DTOs;
using Application.DTOs.CostNorms;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using ProcessStatus = Core.Enums.ProcessStatus;
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

    public async Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null, bool? isActive = null)
    {
        var query = _context.CostNorms
            .Include(c => c.Contract)
            .Include(c => c.ContractProduct)
            .Include(c => c.Creator)
            .Include(c => c.Items.OrderBy(i => i.SortOrder))
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll && !contractId.HasValue)
        {
            query = query.Where(c =>
                _context.ContractUsers.Any(cu => cu.ContractId == c.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == c.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                (c.ContractProductId != null && (
                    _context.ContractProductUsers.Any(pu => pu.ContractProductId == c.ContractProductId && pu.UserId == currentUserId) ||
                    _context.ContractProductDepartments.Any(pd => pd.ContractProductId == c.ContractProductId &&
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))
                )));
        }

        if (contractId.HasValue)
            query = query.Where(c => c.ContractId == contractId.Value);

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        var list = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<CostNormResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<CostNormResponseDto>> GetByIdAsync(Guid id)
    {
        var costNorm = await _context.CostNorms
            .Include(c => c.Contract)
            .Include(c => c.ContractProduct)
            .Include(c => c.Creator)
            .Include(c => c.Items.OrderBy(i => i.SortOrder))
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (costNorm is null)
            return ApiResult<CostNormResponseDto>.Failure([$"CostNorm with id '{id}' not found."], 404);

        return ApiResult<CostNormResponseDto>.Success(MapToResponse(costNorm));
    }

    public async Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetByContractIdAsync(Guid contractId)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!contractExists)
            return ApiResult<IEnumerable<CostNormResponseDto>>.Failure([$"Contract with id '{contractId}' not found."], 404);

        return await GetAllAsync(Guid.Empty, viewAll: true, contractId);
    }

    public async Task<ApiResult<Guid>> CreateAsync(CostNormCreateDto dto, Guid createdBy)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId);
        if (!contractExists)
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
            Items = dto.Items.Select((item, index) => new CostNormItem
            {
                Id = Guid.NewGuid(),
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
            }).ToList()
        };

        _context.CostNorms.Add(costNorm);
        await _context.SaveChangesAsync();

        await RegenerateDocxAsync(costNorm, createdBy);

        var contract = await _context.Contracts
            .Include(c => c.ContractUsers)
            .Include(c => c.ContractDepartments)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == dto.ContractId);

        var contractUserIds = contract?.ContractUsers.Select(cu => cu.UserId) ?? Enumerable.Empty<Guid>();
        var deptUserIds = contract is not null
            ? await _context.Users
                .Where(u => u.IsActive && contract.ContractDepartments.Select(cd => cd.DepartmentId).Contains(u.DepartmentId!.Value))
                .Select(u => u.Id)
                .ToListAsync()
            : new List<Guid>();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            contractUserIds.Union(deptUserIds),
            $"Yangi me'yoriy sarf: {costNorm.Title}",
            $"«{contract?.ContractNo}» shartnomasi uchun me'yoriy sarf norma tuzildi: {costNorm.Title}. Materiallar: {costNorm.Items.Count} ta.",
            NotificationType.Info,
            dto.ContractId);

        return ApiResult<Guid>.Success(costNorm.Id, 201);
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
        var costNorm = await _context.CostNorms
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id);

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

        if (dto.Items is not null)
        {
            var oldItems = costNorm.Items.ToList();
            _context.CostNormItems.RemoveRange(oldItems);
            var newItems = dto.Items.Select((item, index) => new CostNormItem
            {
                Id = Guid.NewGuid(),
                CostNormId = costNorm.Id,
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
            }).ToList();
            await _context.CostNormItems.AddRangeAsync(newItems);
        }

        await _context.SaveChangesAsync();

        // Reload items: in the items-update branch we add rows via the DbSet directly,
        // so the navigation collection on costNorm is stale at this point.
        costNorm.Items = await _context.CostNormItems
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

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var costNorm = await _context.CostNorms.FirstOrDefaultAsync(c => c.Id == id);

        if (costNorm is null)
            return ApiResult<int>.Failure([$"CostNorm with id '{id}' not found."], 404);

        await _attachmentService.DeleteAllAsync("costnorm", id);
        _context.CostNorms.Remove(costNorm);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
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

    private static CostNormResponseDto MapToResponse(CostNorm c) => new()
    {
        Id = c.Id,
        ContractId = c.ContractId,
        ContractNo = c.Contract?.ContractNo ?? string.Empty,
        ContractProductId = c.ContractProductId,
        ProductType = c.ContractProduct?.ProductType,
        ContractQuantity = c.ContractProduct?.Quantity > 0 ? c.ContractProduct.Quantity : 1,
        Title = c.Title,
        Notes = c.Notes,
        Status = c.Status,
        CreatedBy = c.CreatedBy,
        CreatedByFullName = c.Creator is not null
            ? $"{c.Creator.FirstName} {c.Creator.LastName}"
            : null,
        CreatedAt = c.CreatedAt,
        IsActive = c.IsActive,
        Metadata = DeserializeMetadata(c.MetadataJson),
        Items = c.Items.Select(i => new CostNormItemResponseDto
        {
            Id = i.Id,
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
        }).ToList()
    };
}
