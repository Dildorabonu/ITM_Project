using Application.DTOs;
using Application.DTOs.ContractTasks;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ContractTaskService : IContractTaskService
{
    private readonly DatabaseContext _context;

    public ContractTaskService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<ContractTaskResponseDto>>> GetByContractIdAsync(Guid contractId)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!contractExists)
            return ApiResult<IEnumerable<ContractTaskResponseDto>>.Failure([$"Contract with id '{contractId}' not found."], 404);

        var tasks = await _context.ContractTasks
            .Include(t => t.Creator)
            .AsNoTracking()
            .Where(t => t.ContractId == contractId)
            .OrderBy(t => t.OrderNo)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractTaskResponseDto>>.Success(tasks.Select(MapToResponse));
    }

    public async Task<ApiResult<ContractTaskResponseDto>> GetByIdAsync(Guid id)
    {
        var task = await _context.ContractTasks
            .Include(t => t.Creator)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (task is null)
            return ApiResult<ContractTaskResponseDto>.Failure([$"ContractTask with id '{id}' not found."], 404);

        return ApiResult<ContractTaskResponseDto>.Success(MapToResponse(task));
    }

    public async Task<ApiResult<Guid>> CreateAsync(ContractTaskCreateDto dto, Guid createdBy)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId);
        if (!contractExists)
            return ApiResult<Guid>.Failure([$"Contract with id '{dto.ContractId}' not found."], 404);

        var nextOrder = await _context.ContractTasks
            .Where(t => t.ContractId == dto.ContractId)
            .MaxAsync(t => (int?)t.OrderNo) ?? 0;

        var task = new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            OrderNo = nextOrder + 1,
            Name = dto.Name,
            CompletedAmount = dto.CompletedAmount,
            TotalAmount = dto.TotalAmount,
            Importance = dto.Importance,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ContractTasks.Add(task);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(task.Id, 201);
    }

    public async Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ContractTaskCreateDto> dtos, Guid createdBy)
    {
        var dtoList = dtos.ToList();
        if (dtoList.Count == 0)
            return ApiResult<int>.Failure(["Kamida bitta vazifa kerak."], 400);

        var contractId = dtoList[0].ContractId;
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!contractExists)
            return ApiResult<int>.Failure([$"Contract with id '{contractId}' not found."], 404);

        var nextOrder = await _context.ContractTasks
            .Where(t => t.ContractId == contractId)
            .MaxAsync(t => (int?)t.OrderNo) ?? 0;

        var tasks = dtoList.Select((dto, i) => new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            OrderNo = nextOrder + i + 1,
            Name = dto.Name,
            CompletedAmount = dto.CompletedAmount,
            TotalAmount = dto.TotalAmount,
            Importance = dto.Importance,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        }).ToList();

        _context.ContractTasks.AddRange(tasks);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(tasks.Count, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ContractTaskUpdateDto dto)
    {
        var task = await _context.ContractTasks.FirstOrDefaultAsync(t => t.Id == id);
        if (task is null)
            return ApiResult<int>.Failure([$"ContractTask with id '{id}' not found."], 404);

        if (dto.Name is not null) task.Name = dto.Name;
        if (dto.CompletedAmount.HasValue) task.CompletedAmount = dto.CompletedAmount.Value;
        if (dto.TotalAmount.HasValue) task.TotalAmount = dto.TotalAmount.Value;
        if (dto.Importance.HasValue) task.Importance = dto.Importance.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var task = await _context.ContractTasks.FirstOrDefaultAsync(t => t.Id == id);
        if (task is null)
            return ApiResult<int>.Failure([$"ContractTask with id '{id}' not found."], 404);

        _context.ContractTasks.Remove(task);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static ContractTaskResponseDto MapToResponse(ContractTask t)
    {
        var pct = t.TotalAmount > 0 ? Math.Round(t.CompletedAmount / t.TotalAmount * 100, 1) : 0;
        return new ContractTaskResponseDto
        {
            Id = t.Id,
            ContractId = t.ContractId,
            OrderNo = t.OrderNo,
            Name = t.Name,
            CompletedAmount = t.CompletedAmount,
            TotalAmount = t.TotalAmount,
            Importance = t.Importance,
            PercentComplete = pct,
            CreatedBy = t.CreatedBy,
            CreatedByFullName = t.Creator is not null
                ? $"{t.Creator.FirstName} {t.Creator.LastName}"
                : null,
            CreatedAt = t.CreatedAt,
        };
    }
}
