using Application.DTOs;
using Application.DTOs.Shipments;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ShipmentBatchService : IShipmentBatchService
{
    private readonly DatabaseContext _context;
    private readonly IActivityLogService _activityLogService;

    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    public ShipmentBatchService(DatabaseContext context, IActivityLogService activityLogService)
    {
        _context = context;
        _activityLogService = activityLogService;
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

        ContractProduct? product = null;
        if (dto.ContractProductId.HasValue)
        {
            product = await _context.ContractProducts
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (product is null)
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

        // Tayyor miqdor: odatda ombor vazifasining CompletedAmount'i. Vazifa yo'q,
        // lekin mahsulot Completed bo'lsa (masalan, holat qo'lda o'tkazilgan) —
        // to'liq miqdor omborda deb hisoblanadi, aks holda partiya yaratilmaydi.
        decimal ready;
        if (warehouseTask is not null)
            ready = warehouseTask.CompletedAmount;
        else if (product is { Status: ContractProductStatus.Completed })
            ready = product.Quantity;
        else
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                ["Ushbu mahsulot uchun ombor vazifasi topilmadi — partiya yaratib bo'lmaydi."]);

        // Shartnomadagi mahsulot miqdori — jo'natmalar uchun mutlaq yuqori chegara.
        if (product is not null && ready > product.Quantity)
            ready = product.Quantity;

        var alreadyShipped = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId && s.ContractProductId == dto.ContractProductId)
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        var available = ready - alreadyShipped;
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
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ShipmentBatches.Add(batch);
        await _context.SaveChangesAsync();

        // Re-load with navigation for response
        var created = await _context.ShipmentBatches
            .Include(s => s.Department)
            .Include(s => s.Creator)
            .Include(s => s.Contract)
            .AsNoTracking()
            .FirstAsync(s => s.Id == batch.Id);

        await _activityLogService.LogAsync(
            kind: "shipment",
            title: $"Partiya #{created.BatchNo} — {created.Amount}",
            subtitle: created.Contract?.ContractNo,
            actorId: userId,
            refId: created.Id);

        return ApiResult<ShipmentBatchResponseDto>.Success(MapToResponse(created), 201);
    }

    private static ShipmentBatchResponseDto MapToResponse(ShipmentBatch s) => new()
    {
        Id = s.Id,
        ContractProductId = s.ContractProductId,
        DepartmentName = s.Department?.Name,
        BatchNo = s.BatchNo,
        Amount = s.Amount,
        CreatedByFullName = s.Creator is null ? null : $"{s.Creator.FirstName} {s.Creator.LastName}".Trim(),
        CreatedAt = s.CreatedAt,
    };
}
