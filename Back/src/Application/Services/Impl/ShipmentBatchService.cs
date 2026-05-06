using Application.DTOs;
using Application.DTOs.Shipments;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ShipmentBatchService : IShipmentBatchService
{
    private readonly DatabaseContext _context;

    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    public ShipmentBatchService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> GetByContractAsync(
        Guid contractId, Guid? contractProductId)
    {
        var query = _context.ShipmentBatches
            .Include(s => s.Department)
            .Include(s => s.Creator)
            .AsNoTracking()
            .Where(s => s.ContractId == contractId);

        if (contractProductId.HasValue)
            query = query.Where(s => s.ContractProductId == contractProductId.Value);

        var batches = await query
            .OrderBy(s => s.BatchNo)
            .ToListAsync();

        return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Success(batches.Select(MapToResponse));
    }

    public async Task<ApiResult<ShipmentBatchResponseDto>> CreateAsync(ShipmentBatchCreateDto dto, Guid userId)
    {
        if (dto.Amount <= 0)
            return ApiResult<ShipmentBatchResponseDto>.Failure(["Miqdor 0 dan katta bo'lishi kerak."]);

        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId);
        if (!contractExists)
            return ApiResult<ShipmentBatchResponseDto>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."], 404);

        if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (!productOk)
                return ApiResult<ShipmentBatchResponseDto>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        if (dto.DepartmentId.HasValue)
        {
            var deptOk = await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value);
            if (!deptOk)
                return ApiResult<ShipmentBatchResponseDto>.Failure([$"Bo'lim '{dto.DepartmentId}' topilmadi."], 404);
        }

        // Tayyor miqdor — warehouse task'ning CompletedAmount.
        var warehouseTask = await _context.ContractTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.IsActive
                                      && t.ContractId == dto.ContractId
                                      && t.ContractProductId == dto.ContractProductId
                                      && t.Name == WarehouseTaskName);

        if (warehouseTask is null)
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                ["Ushbu mahsulot uchun ombor vazifasi topilmadi — partiya yaratib bo'lmaydi."]);

        var alreadyShipped = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId && s.ContractProductId == dto.ContractProductId)
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        var available = warehouseTask.CompletedAmount - alreadyShipped;
        if (dto.Amount > available)
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                [$"Miqdor mavjud qoldiqdan oshib ketdi. Mavjud: {available}."]);

        var nextBatchNo = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId && s.ContractProductId == dto.ContractProductId)
            .MaxAsync(s => (int?)s.BatchNo) ?? 0;

        var batch = new ShipmentBatch
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            DepartmentId = dto.DepartmentId,
            BatchNo = nextBatchNo + 1,
            Amount = dto.Amount,
            Notes = dto.Notes,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ShipmentBatches.Add(batch);
        await _context.SaveChangesAsync();

        // Re-load with navigation for response
        var created = await _context.ShipmentBatches
            .Include(s => s.Department)
            .Include(s => s.Creator)
            .AsNoTracking()
            .FirstAsync(s => s.Id == batch.Id);

        return ApiResult<ShipmentBatchResponseDto>.Success(MapToResponse(created), 201);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var batch = await _context.ShipmentBatches.FirstOrDefaultAsync(s => s.Id == id);
        if (batch is null)
            return ApiResult<int>.Failure([$"Partiya '{id}' topilmadi."], 404);

        _context.ShipmentBatches.Remove(batch);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static ShipmentBatchResponseDto MapToResponse(ShipmentBatch s) => new()
    {
        Id = s.Id,
        ContractId = s.ContractId,
        ContractProductId = s.ContractProductId,
        DepartmentId = s.DepartmentId,
        DepartmentName = s.Department?.Name,
        BatchNo = s.BatchNo,
        Amount = s.Amount,
        Notes = s.Notes,
        CreatedBy = s.CreatedBy,
        CreatedByFullName = s.Creator is null ? null : $"{s.Creator.FirstName} {s.Creator.LastName}".Trim(),
        CreatedAt = s.CreatedAt,
    };
}
