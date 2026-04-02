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
            .Include(t => t.Steps.OrderBy(s => s.StepNumber))
            .Include(t => t.Materials).ThenInclude(m => m.Material)
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
            .Include(t => t.Steps.OrderBy(s => s.StepNumber))
            .Include(t => t.Materials).ThenInclude(m => m.Material)
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

        tp.Status = ProcessStatus.InProgress;
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

    // ── Steps ──────────────────────────────────────────────────────────────────

    public async Task<ApiResult<Guid>> AddStepAsync(Guid techProcessId, TechStepCreateDto dto)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == techProcessId);
        if (tp is null)
            return ApiResult<Guid>.Failure([$"TechProcess '{techProcessId}' topilmadi."], 404);

        var step = new TechStep
        {
            Id = Guid.NewGuid(),
            TechProcessId = techProcessId,
            StepNumber = dto.StepNumber,
            Name = dto.Name,
            ResponsibleDept = dto.ResponsibleDept,
            Machine = dto.Machine,
            TimeNorm = dto.TimeNorm,
            Notes = dto.Notes,
            Status = ProcessStatus.Pending
        };

        _context.TechSteps.Add(step);
        await _context.SaveChangesAsync();
        return ApiResult<Guid>.Success(step.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateStepAsync(Guid techProcessId, Guid stepId, TechStepUpdateDto dto)
    {
        var step = await _context.TechSteps
            .FirstOrDefaultAsync(s => s.Id == stepId && s.TechProcessId == techProcessId);

        if (step is null)
            return ApiResult<int>.Failure(["Qadam topilmadi."], 404);

        if (dto.StepNumber.HasValue) step.StepNumber = dto.StepNumber.Value;
        if (dto.Name is not null) step.Name = dto.Name;
        if (dto.ResponsibleDept is not null) step.ResponsibleDept = dto.ResponsibleDept;
        if (dto.Machine is not null) step.Machine = dto.Machine;
        if (dto.TimeNorm is not null) step.TimeNorm = dto.TimeNorm;
        if (dto.Notes is not null) step.Notes = dto.Notes;

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    public async Task<ApiResult<int>> DeleteStepAsync(Guid techProcessId, Guid stepId)
    {
        var step = await _context.TechSteps
            .FirstOrDefaultAsync(s => s.Id == stepId && s.TechProcessId == techProcessId);

        if (step is null)
            return ApiResult<int>.Failure(["Qadam topilmadi."], 404);

        _context.TechSteps.Remove(step);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    // ── Materials ──────────────────────────────────────────────────────────────

    public async Task<ApiResult<Guid>> AddMaterialAsync(Guid techProcessId, TechProcessMaterialCreateDto dto)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == techProcessId);
        if (tp is null)
            return ApiResult<Guid>.Failure([$"TechProcess '{techProcessId}' topilmadi."], 404);

        var materialExists = await _context.Materials.AnyAsync(m => m.Id == dto.MaterialId);
        if (!materialExists)
            return ApiResult<Guid>.Failure([$"Material '{dto.MaterialId}' topilmadi."]);

        var alreadyAdded = await _context.TechProcessMaterials
            .AnyAsync(m => m.TechProcessId == techProcessId && m.MaterialId == dto.MaterialId);
        if (alreadyAdded)
            return ApiResult<Guid>.Failure(["Bu material allaqachon qo'shilgan."]);

        var material = new TechProcessMaterial
        {
            Id = Guid.NewGuid(),
            TechProcessId = techProcessId,
            MaterialId = dto.MaterialId,
            RequiredQty = dto.RequiredQty,
            AvailableQty = 0,
            Status = "Pending"
        };

        _context.TechProcessMaterials.Add(material);
        await _context.SaveChangesAsync();
        return ApiResult<Guid>.Success(material.Id, 201);
    }

    public async Task<ApiResult<int>> DeleteMaterialAsync(Guid techProcessId, Guid materialId)
    {
        var item = await _context.TechProcessMaterials
            .FirstOrDefaultAsync(m => m.TechProcessId == techProcessId && m.MaterialId == materialId);

        if (item is null)
            return ApiResult<int>.Failure(["Material topilmadi."], 404);

        _context.TechProcessMaterials.Remove(item);
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
        Steps = tp.Steps.Select(s => new TechStepResponseDto
        {
            Id = s.Id,
            StepNumber = s.StepNumber,
            Name = s.Name,
            ResponsibleDept = s.ResponsibleDept,
            Machine = s.Machine,
            TimeNorm = s.TimeNorm,
            Status = s.Status,
            Notes = s.Notes
        }).ToList(),
        Materials = tp.Materials.Select(m => new TechProcessMaterialResponseDto
        {
            Id = m.Id,
            MaterialId = m.MaterialId,
            MaterialName = m.Material?.Name ?? string.Empty,
            Unit = m.Material?.Unit ?? string.Empty,
            RequiredQty = m.RequiredQty,
            AvailableQty = m.AvailableQty,
            Status = m.Status
        }).ToList()
    };
}
