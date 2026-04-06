using Application.DTOs;
using Application.DTOs.TechProcesses;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using DrawingStatus = Core.Enums.DrawingStatus;
using SysTask = System.Threading.Tasks.Task;


namespace Application.Services.Impl;

public class TechProcessService : ITechProcessService
{
    private readonly DatabaseContext _context;

    public TechProcessService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ProcessStatus? status = null)
    {
        var query = _context.TechProcesses
            .Include(t => t.Contract)
            .Include(t => t.Approver)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
        {
            query = query.Where(t =>
                _context.ContractUsers.Any(cu => cu.ContractId == t.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == t.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)));
        }

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        var list = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<TechProcessResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<TechProcessResponseDto>> GetByIdAsync(Guid id)
    {
        var tp = await _context.TechProcesses
            .Include(t => t.Contract)
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

        var tp = new TechProcess
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            Title = dto.Title,
            Status = ProcessStatus.Pending,
            CurrentStep = 0,
            CreatedAt = DateTime.UtcNow
        };

        _context.TechProcesses.Add(tp);

        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == dto.ContractId);
        if (contract is not null && contract.Status == ContractStatus.DrawingPending)
            contract.Status = ContractStatus.TechProcessing;

        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(tp.Id, 201);
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

    public async Task<ApiResult<int>> UpdateAsync(Guid id, TechProcessUpdateDto dto)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status == ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Tasdiqlangan jarayonni tahrirlash mumkin emas."]);

        if (dto.Title is not null) tp.Title = dto.Title;

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
        await TryAdvanceToWarehouseCheckAsync(tp.ContractId);
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
        Title = tp.Title,
        Status = tp.Status,
        CurrentStep = tp.CurrentStep,
        ApprovedBy = tp.ApprovedBy,
        ApprovedByFullName = tp.Approver is null ? null
            : $"{tp.Approver.FirstName} {tp.Approver.LastName}",
        ApprovedAt = tp.ApprovedAt,
        CreatedAt = tp.CreatedAt,
        IsActive = tp.Contract?.IsActive ?? true,
    };
}
