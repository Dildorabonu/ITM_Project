using Application.DTOs;
using Application.DTOs.CostNorms;
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

    public CostNormService(DatabaseContext context, INotificationService notificationService, IAttachmentService attachmentService)
    {
        _context = context;
        _notificationService = notificationService;
        _attachmentService = attachmentService;
    }

    public async Task<ApiResult<IEnumerable<CostNormResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, Guid? contractId = null)
    {
        var query = _context.CostNorms
            .Include(c => c.Contract)
            .Include(c => c.Creator)
            .Include(c => c.Items.OrderBy(i => i.SortOrder))
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll && !contractId.HasValue)
        {
            query = query.Where(c =>
                _context.ContractUsers.Any(cu => cu.ContractId == c.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == c.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)));
        }

        if (contractId.HasValue)
            query = query.Where(c => c.ContractId == contractId.Value);

        var list = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<CostNormResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<CostNormResponseDto>> GetByIdAsync(Guid id)
    {
        var costNorm = await _context.CostNorms
            .Include(c => c.Contract)
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

        var costNorm = new CostNorm
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            Title = dto.Title,
            Notes = dto.Notes,
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

        await TryAdvanceToWarehouseCheckAsync(dto.ContractId);

        return ApiResult<Guid>.Success(costNorm.Id, 201);
    }

    private async SysTask TryAdvanceToWarehouseCheckAsync(Guid contractId)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == contractId);
        if (contract is null || contract.Status != ContractStatus.TechProcessing)
            return;

        var techProcessApproved = await _context.TechProcesses
            .AnyAsync(t => t.ContractId == contractId && t.Status == ProcessStatus.Approved);
        var costNormApproved = await _context.CostNorms
            .AnyAsync(c => c.ContractId == contractId && c.Status == DrawingStatus.Approved);

        if (techProcessApproved && costNormApproved)
        {
            contract.Status = ContractStatus.WarehouseCheck;
            await _context.SaveChangesAsync();
        }
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
        await TryAdvanceToWarehouseCheckAsync(costNorm.ContractId);
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

    private static CostNormResponseDto MapToResponse(CostNorm c) => new()
    {
        Id = c.Id,
        ContractId = c.ContractId,
        ContractNo = c.Contract?.ContractNo ?? string.Empty,
        Title = c.Title,
        Notes = c.Notes,
        Status = c.Status,
        CreatedBy = c.CreatedBy,
        CreatedByFullName = c.Creator is not null
            ? $"{c.Creator.FirstName} {c.Creator.LastName}"
            : null,
        CreatedAt = c.CreatedAt,
        IsActive = c.Contract?.IsActive ?? true,
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
