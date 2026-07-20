using Application.DTOs;
using Application.DTOs.ContractTasks;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ContractTaskService : IContractTaskService
{
    private readonly DatabaseContext _context;
    private readonly IManufacturedProductService _manufacturedProductService;
    private readonly IActivityLogService _activityLogService;

    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    public ContractTaskService(
        DatabaseContext context,
        IManufacturedProductService manufacturedProductService,
        IActivityLogService activityLogService)
    {
        _context = context;
        _manufacturedProductService = manufacturedProductService;
        _activityLogService = activityLogService;
    }

    public async Task<ApiResult<IEnumerable<ContractTaskResponseDto>>> GetByContractIdAsync(Guid contractId)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!contractExists)
            return ApiResult<IEnumerable<ContractTaskResponseDto>>.Failure([$"Contract with id '{contractId}' not found."], 404);

        var tasks = await _context.ContractTasks
            .Include(t => t.ContractProduct)
            .AsNoTracking()
            .Where(t => t.ContractId == contractId)
            .OrderBy(t => t.OrderNo)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractTaskResponseDto>>.Success(tasks.Select(MapToResponse));
    }

    public async Task<ApiResult<Guid>> CreateAsync(ContractTaskCreateDto dto, Guid createdBy)
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

        var lockError = await GetScopeLockErrorAsync(dto.ContractId, dto.ContractProductId);
        if (lockError is not null)
            return ApiResult<Guid>.Failure([lockError], 400);

        var nextOrder = await _context.ContractTasks
            .Where(t => t.ContractId == dto.ContractId)
            .MaxAsync(t => (int?)t.OrderNo) ?? 0;

        var task = new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
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

        var validProductIds = await _context.ContractProducts
            .Where(p => p.ContractId == contractId)
            .Select(p => p.Id)
            .ToListAsync();

        foreach (var dto in dtoList)
        {
            if (dto.ContractProductId.HasValue && !validProductIds.Contains(dto.ContractProductId.Value))
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        foreach (var scopeProductId in dtoList.Select(d => d.ContractProductId).Distinct())
        {
            var lockError = await GetScopeLockErrorAsync(contractId, scopeProductId);
            if (lockError is not null)
                return ApiResult<int>.Failure([lockError], 400);
        }

        var nextOrder = await _context.ContractTasks
            .Where(t => t.ContractId == contractId)
            .MaxAsync(t => (int?)t.OrderNo) ?? 0;

        var tasks = dtoList.Select((dto, i) => new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
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

        var lockError = await GetScopeLockErrorAsync(task.ContractId, task.ContractProductId);
        if (lockError is not null)
            return ApiResult<int>.Failure([lockError], 400);

        var newCompleted = dto.CompletedAmount ?? task.CompletedAmount;
        var newTotal = dto.TotalAmount ?? task.TotalAmount;
        if (newTotal > 0 && newCompleted > newTotal)
            return ApiResult<int>.Failure(
                [$"Bajarilgan miqdor vazifaning umumiy miqdoridan ({newTotal}) oshmasligi kerak."]);

        if (dto.CompletedAmount.HasValue && task.Name == WarehouseTaskName)
        {
            var cap = await GetWarehouseCompletedCapAsync(task);
            if (cap.HasValue && dto.CompletedAmount.Value > cap.Value)
                return ApiResult<int>.Failure(
                    [$"Omborga topshirish miqdori boshqa vazifalarning eng kam bajarilgan qiymatidan ({cap.Value}) oshmasligi kerak."]);

            // Jo'natilgan partiyalar yig'indisidan pastga tushirish taqiqlanadi —
            // aks holda "jo'natilgan > tayyor" nomuvofiqligi paydo bo'ladi.
            var shipped = await _context.ShipmentBatches
                .Where(s => s.ContractId == task.ContractId && s.ContractProductId == task.ContractProductId)
                .SumAsync(s => (decimal?)s.Amount) ?? 0m;
            if (dto.CompletedAmount.Value < shipped)
                return ApiResult<int>.Failure(
                    [$"Omborga topshirilgan miqdorni jo'natilgan partiyalar yig'indisidan ({shipped}) pastga tushirib bo'lmaydi."]);
        }

        if (dto.Name is not null) task.Name = dto.Name;
        if (dto.CompletedAmount.HasValue) task.CompletedAmount = dto.CompletedAmount.Value;
        if (dto.TotalAmount.HasValue) task.TotalAmount = dto.TotalAmount.Value;
        if (dto.Importance.HasValue) task.Importance = dto.Importance.Value;
        if (dto.OrderNo.HasValue) task.OrderNo = dto.OrderNo.Value;

        if (dto.ClearContractProduct)
        {
            task.ContractProductId = null;
        }
        else if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == task.ContractId);
            if (!productOk)
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
            task.ContractProductId = dto.ContractProductId.Value;
        }

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var task = await _context.ContractTasks.FirstOrDefaultAsync(t => t.Id == id);
        if (task is null)
            return ApiResult<int>.Failure([$"ContractTask with id '{id}' not found."], 404);

        var lockError = await GetScopeLockErrorAsync(task.ContractId, task.ContractProductId);
        if (lockError is not null)
            return ApiResult<int>.Failure([lockError], 400);

        _context.ContractTasks.Remove(task);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<Guid>> LogProgressAsync(Guid taskId, ContractTaskLogCreateDto dto, Guid createdBy)
    {
        var task = await _context.ContractTasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null)
            return ApiResult<Guid>.Failure([$"ContractTask with id '{taskId}' not found."], 404);

        var lockError = await GetScopeLockErrorAsync(task.ContractId, task.ContractProductId);
        if (lockError is not null)
            return ApiResult<Guid>.Failure([lockError], 400);

        if (dto.Amount <= 0)
            return ApiResult<Guid>.Failure(["Miqdor 0 dan katta bo'lishi kerak."], 400);

        if (task.TotalAmount > 0 && task.CompletedAmount + dto.Amount > task.TotalAmount)
        {
            var totalRemaining = Math.Max(0m, task.TotalAmount - task.CompletedAmount);
            return ApiResult<Guid>.Failure(
                [$"Bajarilgan miqdor vazifaning umumiy miqdoridan ({task.TotalAmount}) oshmasligi kerak. Qoldiq: {totalRemaining}."]);
        }

        if (task.Name == WarehouseTaskName)
        {
            var cap = await GetWarehouseCompletedCapAsync(task);
            if (cap.HasValue && task.CompletedAmount + dto.Amount > cap.Value)
            {
                var remaining = Math.Max(0m, cap.Value - task.CompletedAmount);
                return ApiResult<Guid>.Failure(
                    [$"Omborga topshirish miqdori boshqa vazifalarning eng kam bajarilgan qiymatidan ({cap.Value}) oshmasligi kerak. Qoldiq: {remaining}."]);
            }
        }

        var log = new ContractTaskDailyLog
        {
            Id = Guid.NewGuid(),
            TaskId = taskId,
            Amount = dto.Amount,
            Note = dto.Note,
            Date = dto.Date,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        };

        task.CompletedAmount += dto.Amount;

        _context.ContractTaskDailyLogs.Add(log);
        await _context.SaveChangesAsync();

        // Ombor vazifasi progress logi qo'shilsa — tayyor mahsulot qatorining miqdorini yangilaymiz.
        if (task.Name == WarehouseTaskName && task.ContractProductId.HasValue)
            await _manufacturedProductService.UpdateProducedQuantityAsync(task.ContractId, task.ContractProductId);

        var contractNo = await _context.Contracts
            .AsNoTracking()
            .Where(c => c.Id == task.ContractId)
            .Select(c => c.ContractNo)
            .FirstOrDefaultAsync();

        await _activityLogService.LogAsync(
            kind: "task-log",
            title: $"{log.Amount} {task.Name}",
            subtitle: contractNo,
            actorId: createdBy,
            refId: task.Id);

        return ApiResult<Guid>.Success(log.Id, 201);
    }

    public async Task<ApiResult<IEnumerable<ContractTaskLogResponseDto>>> GetLogsAsync(Guid taskId)
    {
        var taskExists = await _context.ContractTasks.AnyAsync(t => t.Id == taskId);
        if (!taskExists)
            return ApiResult<IEnumerable<ContractTaskLogResponseDto>>.Failure([$"ContractTask with id '{taskId}' not found."], 404);

        var logs = await _context.ContractTaskDailyLogs
            .Include(l => l.Creator)
            .AsNoTracking()
            .Where(l => l.TaskId == taskId)
            .OrderByDescending(l => l.Date)
            .ThenByDescending(l => l.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractTaskLogResponseDto>>.Success(logs.Select(l => new ContractTaskLogResponseDto
        {
            Id = l.Id,
            Amount = l.Amount,
            CreatedByFullName = l.Creator is not null ? $"{l.Creator.FirstName} {l.Creator.LastName}" : null,
            CreatedAt = l.CreatedAt,
        }));
    }

    // ── Scope lock ────────────────────────────────────────────────────────────
    // Yakunlangan yoki bekor qilingan scope vazifalari tarixiy hujjat — ularni
    // qo'shish, o'zgartirish, o'chirish yoki progress kiritish taqiqlanadi.
    // Scope qulflangan hisoblanadi: shartnoma noaktiv/yakunlangan/bekor qilingan,
    // mahsulot yakunlangan/bekor qilingan yoki ombor vazifasi 100% bajarilgan bo'lsa.
    private async Task<string?> GetScopeLockErrorAsync(Guid contractId, Guid? contractProductId)
    {
        var contract = await _context.Contracts
            .AsNoTracking()
            .Where(c => c.Id == contractId)
            .Select(c => new { c.IsActive, c.Status })
            .FirstOrDefaultAsync();

        // Shartnoma topilmasa — 404 ni chaqiruvchi metodning o'z tekshiruvi qaytaradi.
        if (contract is null)
            return null;

        if (!contract.IsActive || contract.Status == ContractStatus.Cancelled)
            return "Bekor qilingan shartnoma vazifalari ustida amal bajarib bo'lmaydi.";

        if (contract.Status == ContractStatus.Completed)
            return "Yakunlangan shartnoma vazifalari ustida amal bajarib bo'lmaydi.";

        if (contractProductId.HasValue)
        {
            var productStatus = await _context.ContractProducts
                .AsNoTracking()
                .Where(p => p.Id == contractProductId.Value)
                .Select(p => (ContractProductStatus?)p.Status)
                .FirstOrDefaultAsync();

            if (productStatus == ContractProductStatus.Cancelled)
                return "Bekor qilingan mahsulot vazifalari ustida amal bajarib bo'lmaydi.";

            if (productStatus == ContractProductStatus.Completed)
                return "Yakunlangan mahsulot vazifalari ustida amal bajarib bo'lmaydi.";
        }

        var warehouseQuery = _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.IsActive && t.ContractId == contractId && t.Name == WarehouseTaskName);

        warehouseQuery = contractProductId.HasValue
            ? warehouseQuery.Where(t => t.ContractProductId == contractProductId.Value)
            : warehouseQuery.Where(t => t.ContractProductId == null);

        var processFinished = await warehouseQuery
            .AnyAsync(t => t.TotalAmount > 0 && t.CompletedAmount >= t.TotalAmount);

        return processFinished
            ? "Jarayon yakunlangan — barcha mahsulot omborga topshirilgan. Vazifalar ustida amal bajarib bo'lmaydi."
            : null;
    }

    // Warehouse task uchun cap — bir xil scope ichidagi boshqa vazifalarning eng kam
    // CompletedAmount qiymati. Boshqa vazifa yo'q bo'lsa null (cap qo'yilmaydi).
    private async Task<decimal?> GetWarehouseCompletedCapAsync(ContractTask warehouseTask)
    {
        var query = _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.IsActive
                        && t.Id != warehouseTask.Id
                        && t.ContractId == warehouseTask.ContractId
                        && t.Name != WarehouseTaskName);

        query = warehouseTask.ContractProductId.HasValue
            ? query.Where(t => t.ContractProductId == warehouseTask.ContractProductId)
            : query.Where(t => t.ContractProductId == null);

        var siblings = await query.Select(t => t.CompletedAmount).ToListAsync();
        return siblings.Count == 0 ? null : siblings.Min();
    }

    private static ContractTaskResponseDto MapToResponse(ContractTask t)
    {
        var pct = t.TotalAmount > 0 ? Math.Round(t.CompletedAmount / t.TotalAmount * 100, 1) : 0;
        return new ContractTaskResponseDto
        {
            Id = t.Id,
            ContractProductId = t.ContractProductId,
            ProductType = t.ContractProduct?.ProductType,
            OrderNo = t.OrderNo,
            Name = t.Name,
            CompletedAmount = t.CompletedAmount,
            TotalAmount = t.TotalAmount,
            Importance = t.Importance,
            PercentComplete = pct,
        };
    }
}
