using Application.DTOs;
using Application.DTOs.TechProcesses;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using SysTask = System.Threading.Tasks.Task;


namespace Application.Services.Impl;

public class TechProcessService : ITechProcessService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IManufacturedProductService _manufacturedProductService;

    public TechProcessService(
        DatabaseContext context,
        INotificationService notificationService,
        IManufacturedProductService manufacturedProductService)
    {
        _context = context;
        _notificationService = notificationService;
        _manufacturedProductService = manufacturedProductService;
    }

    public async Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ProcessStatus? status = null, bool? isActive = null)
    {
        var query = _context.TechProcesses
            .Include(t => t.Contract)
            .Include(t => t.ContractProduct)
            .Include(t => t.Approver)
            .AsNoTracking();

        if (!viewAll)
        {
            query = query.Where(t =>
                _context.ContractUsers.Any(cu => cu.ContractId == t.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == t.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                (t.ContractProductId != null && (
                    _context.ContractProductUsers.Any(pu => pu.ContractProductId == t.ContractProductId && pu.UserId == currentUserId) ||
                    _context.ContractProductDepartments.Any(pd => pd.ContractProductId == t.ContractProductId &&
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))
                )));
        }

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        if (isActive.HasValue)
            query = query.Where(t => t.IsActive == isActive.Value);

        var list = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<TechProcessResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<TechProcessResponseDto>> GetByIdAsync(Guid id)
    {
        var tp = await _context.TechProcesses
            .Include(t => t.Contract)
            .Include(t => t.ContractProduct)
            .Include(t => t.Approver)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tp is null)
            return ApiResult<TechProcessResponseDto>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        return ApiResult<TechProcessResponseDto>.Success(MapToResponse(tp));
    }

    public async Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetByContractIdAsync(Guid contractId)
    {
        var list = await _context.TechProcesses
            .Include(t => t.Contract)
            .Include(t => t.ContractProduct)
            .Include(t => t.Approver)
            .AsNoTracking()
            .Where(t => t.ContractId == contractId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<TechProcessResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<Guid>> CreateAsync(TechProcessCreateDto dto, Guid createdBy)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId);
        if (!contractExists)
            return ApiResult<Guid>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."]);

        if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (!productOk)
                return ApiResult<Guid>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        var tp = new TechProcess
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            Title = dto.Title,
            Notes = dto.Notes,
            Status = ProcessStatus.InProgress,
            CurrentStep = 0,
            CreatedAt = DateTime.UtcNow
        };

        _context.TechProcesses.Add(tp);

        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == dto.ContractId);
        if (contract is not null && contract.Status == ContractStatus.DrawingPending)
            contract.Status = ContractStatus.TechProcessing;

        await _context.SaveChangesAsync();

        if (contract is not null)
        {
            var deptUserIds = await _context.Users
                .Where(u => u.IsActive && _context.ContractDepartments
                    .Any(cd => cd.ContractId == dto.ContractId && cd.DepartmentId == u.DepartmentId))
                .Select(u => u.Id)
                .ToListAsync();

            await _notificationService.NotifyUsersAndSuperAdminsAsync(
                deptUserIds,
                $"Tex jarayon yaratildi: {contract.ContractNo}",
                $"«{contract.ContractNo}» shartnomasi uchun «{tp.Title}» tex jarayoni yaratildi.",
                NotificationType.Info,
                contract.Id);
        }

        return ApiResult<Guid>.Success(tp.Id, 201);
    }

    private async SysTask TryAdvanceToProductionAsync(Guid contractId)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == contractId);
        if (contract is null || contract.Status != ContractStatus.TechProcessing)
            return;

        if (!await IsContractFullyReadyForProductionAsync(contractId))
            return;

        contract.Status = ContractStatus.InProduction;
        await _context.SaveChangesAsync();

        var deptUserIds = await _context.Users
            .Where(u => u.IsActive && _context.ContractDepartments
                .Any(cd => cd.ContractId == contractId && cd.DepartmentId == u.DepartmentId))
            .Select(u => u.Id)
            .ToListAsync();

        var contractUserIds = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .Select(cu => cu.UserId)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            deptUserIds.Union(contractUserIds).Distinct(),
            $"Shartnoma ishlab chiqarishga o'tdi: {contract.ContractNo}",
            $"«{contract.ContractNo}» shartnomasi tex jarayon va xarajat normalari tasdiqlandi. Ishlab chiqarish bosqichiga o'tildi.",
            NotificationType.Task,
            contract.Id);
    }

    // Kontrakt InProduction'ga o'tishi uchun har bir mahsulot alohida tasdiqlangan bo'lishi shart.
    // Mahsulotsiz kontraktlarda esa kontrakt darajasidagi bitta Approved TP + Approved CN yetadi.
    private async Task<bool> IsContractFullyReadyForProductionAsync(Guid contractId)
    {
        var productIds = await _context.ContractProducts
            .Where(p => p.ContractId == contractId)
            .Select(p => p.Id)
            .ToListAsync();

        if (productIds.Count == 0)
        {
            var tpOk = await _context.TechProcesses
                .AnyAsync(t => t.ContractId == contractId && t.Status == ProcessStatus.Approved);
            var cnOk = await _context.CostNorms
                .AnyAsync(c => c.ContractId == contractId && c.Status == DrawingStatus.Approved);
            return tpOk && cnOk;
        }

        var approvedTpProductIds = await _context.TechProcesses
            .Where(t => t.ContractId == contractId
                && t.Status == ProcessStatus.Approved
                && t.ContractProductId != null)
            .Select(t => t.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var approvedCnProductIds = await _context.CostNorms
            .Where(c => c.ContractId == contractId
                && c.Status == DrawingStatus.Approved
                && c.ContractProductId != null)
            .Select(c => c.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var tpSet = approvedTpProductIds.ToHashSet();
        var cnSet = approvedCnProductIds.ToHashSet();
        return productIds.All(pid => tpSet.Contains(pid) && cnSet.Contains(pid));
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, TechProcessUpdateDto dto)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status == ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Tasdiqlangan jarayonni tahrirlash mumkin emas."]);

        if (dto.Title is not null) tp.Title = dto.Title;
        if (dto.Notes is not null) tp.Notes = dto.Notes;

        if (dto.ClearContractProduct)
        {
            tp.ContractProductId = null;
        }
        else if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == tp.ContractId);
            if (!productOk)
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
            tp.ContractProductId = dto.ContractProductId.Value;
        }

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    public async Task<ApiResult<int>> ApproveAsync(Guid id, Guid approvedBy)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status == ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Jarayon allaqachon tasdiqlangan."]);

        tp.Status = ProcessStatus.Approved;
        tp.ApprovedBy = approvedBy;
        tp.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await TryAdvanceToProductionAsync(tp.ContractId);
        await _manufacturedProductService.SyncForContractAsync(tp.ContractId);

        var approveContract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == tp.ContractId);
        if (approveContract is not null)
        {
            var deptUserIds = await _context.Users
                .Where(u => u.IsActive && _context.ContractDepartments
                    .Any(cd => cd.ContractId == tp.ContractId && cd.DepartmentId == u.DepartmentId))
                .Select(u => u.Id)
                .ToListAsync();

            var contractUserIds = await _context.ContractUsers
                .Where(cu => cu.ContractId == tp.ContractId)
                .Select(cu => cu.UserId)
                .ToListAsync();

            await _notificationService.NotifyUsersAndSuperAdminsAsync(
                deptUserIds.Union(contractUserIds).Distinct(),
                $"Tex jarayon tasdiqlandi: {approveContract.ContractNo}",
                $"«{approveContract.ContractNo}» shartnomasi uchun «{tp.Title}» tex jarayoni tasdiqlandi.",
                NotificationType.Task,
                approveContract.Id);
        }

        return ApiResult<int>.Success(1);
    }

    public async Task<ApiResult<int>> SendToWarehouseAsync(Guid id)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status != ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Faqat tasdiqlangan jarayonni omborga yuborish mumkin."]);

        tp.Status = ProcessStatus.Completed;
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        _context.TechProcesses.Remove(tp);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    // ── Mapping ────────────────────────────────────────────────────────────────

    private static TechProcessResponseDto MapToResponse(TechProcess tp) => new()
    {
        Id = tp.Id,
        ContractId = tp.ContractId,
        ContractNo = tp.Contract?.ContractNo ?? string.Empty,
        ContractProductId = tp.ContractProductId,
        ProductType = tp.ContractProduct?.ProductType,
        Title = tp.Title,
        Notes = tp.Notes,
        Status = tp.Status,
        CurrentStep = tp.CurrentStep,
        ApprovedBy = tp.ApprovedBy,
        ApprovedByFullName = tp.Approver is null ? null
            : $"{tp.Approver.FirstName} {tp.Approver.LastName}",
        ApprovedAt = tp.ApprovedAt,
        CreatedAt = tp.CreatedAt,
        IsActive = tp.IsActive,
    };
}
