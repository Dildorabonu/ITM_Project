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
        // To'g'ridan-to'g'ri DTO ga proyeksiya — ContractProduct entity'sini butunlay
        // yuklamasdan, faqat kerakli ustunlar SQL dan olinadi.
        var tasks = await _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.ContractId == contractId)
            .OrderBy(t => t.OrderNo)
            .Select(t => new ContractTaskResponseDto
            {
                Id = t.Id,
                ContractProductId = t.ContractProductId,
                ProductType = t.ContractProduct != null ? t.ContractProduct.ProductType : null,
                OrderNo = t.OrderNo,
                Name = t.Name,
                CompletedAmount = t.CompletedAmount,
                TotalAmount = t.TotalAmount,
                Importance = t.Importance,
            })
            .ToListAsync();

        // Bo'sh natija "shartnoma yo'q" degani emas — 404 ni faqat shu holatda tekshiramiz.
        if (tasks.Count == 0 && !await _context.Contracts.AnyAsync(c => c.Id == contractId))
            return ApiResult<IEnumerable<ContractTaskResponseDto>>.Failure([$"Contract with id '{contractId}' not found."], 404);

        foreach (var t in tasks)
            t.PercentComplete = t.TotalAmount > 0 ? Math.Round(t.CompletedAmount / t.TotalAmount * 100, 1) : 0;

        return ApiResult<IEnumerable<ContractTaskResponseDto>>.Success(tasks);
    }

    public async Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ContractTaskCreateDto> dtos, Guid createdBy)
    {
        var dtoList = dtos as IList<ContractTaskCreateDto> ?? dtos.ToList();
        if (dtoList.Count == 0)
            return ApiResult<int>.Failure(["Kamida bitta vazifa kerak."], 400);

        var contractId = dtoList[0].ContractId;

        // Har bir noyob scope uchun bitta so'rov: shartnoma holati + mahsulot holati/tegishliligi
        // + ombor vazifasi yakunlanganligi — hammasi bitta round-trip'da.
        foreach (var scopeProductId in dtoList.Select(d => d.ContractProductId).Distinct())
        {
            var scope = await LoadScopeAsync(contractId, scopeProductId);
            if (scope is null)
                return ApiResult<int>.Failure([$"Contract with id '{contractId}' not found."], 404);

            var lockError = GetLockError(scope, scopeProductId.HasValue);
            if (lockError is not null)
                return ApiResult<int>.Failure([lockError], 400);
        }

        var nextOrder = await _context.ContractTasks
            .Where(t => t.ContractId == contractId)
            .MaxAsync(t => (int?)t.OrderNo) ?? 0;

        var createdAt = DateTime.UtcNow;
        var tasks = dtoList.Select((dto, i) => new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = contractId,
            ContractProductId = dto.ContractProductId,
            OrderNo = nextOrder + i + 1,
            Name = dto.Name,
            CompletedAmount = dto.CompletedAmount,
            TotalAmount = dto.TotalAmount,
            Importance = dto.Importance,
            CreatedBy = createdBy,
            CreatedAt = createdAt,
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
            // Har tur (ishlab chiqarish partiyasi / mijoz olib ketishi) alohida
            // hisoblanadi — eng kattasi chegara bo'ladi.
            var shipped = await _context.ShipmentBatches
                .Where(s => s.ContractId == task.ContractId && s.ContractProductId == task.ContractProductId)
                .GroupBy(s => s.Kind)
                .Select(g => g.Sum(s => (decimal?)s.Amount) ?? 0m)
                .ToListAsync();
            var shippedCap = shipped.Count == 0 ? 0m : shipped.Max();

            if (dto.CompletedAmount.Value < shippedCap)
                return ApiResult<int>.Failure(
                    [$"Omborga topshirilgan miqdorni jo'natilgan partiyalar yig'indisidan ({shippedCap}) pastga tushirib bo'lmaydi."]);
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
        // Entity'ni to'liq yuklash shart emas — scope tekshiruvi uchun ikki ustun yetarli.
        var scope = await _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new { t.ContractId, t.ContractProductId })
            .FirstOrDefaultAsync();

        if (scope is null)
            return ApiResult<int>.Failure([$"ContractTask with id '{id}' not found."], 404);

        var lockError = await GetScopeLockErrorAsync(scope.ContractId, scope.ContractProductId);
        if (lockError is not null)
            return ApiResult<int>.Failure([lockError], 400);

        await _context.ContractTasks.Where(t => t.Id == id).ExecuteDeleteAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<Guid>> LogProgressAsync(Guid taskId, ContractTaskLogCreateDto dto, Guid createdBy)
    {
        var task = await _context.ContractTasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null)
            return ApiResult<Guid>.Failure([$"ContractTask with id '{taskId}' not found."], 404);

        var scope = await LoadScopeAsync(task.ContractId, task.ContractProductId);
        var lockError = scope is null ? null : GetLockError(scope, task.ContractProductId.HasValue);
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

        // ContractNo scope so'rovida allaqachon olingan — alohida so'rov kerak emas.
        await _activityLogService.LogAsync(
            kind: "task-log",
            title: $"{log.Amount} {task.Name}",
            subtitle: scope?.ContractNo,
            actorId: createdBy,
            refId: task.Id);

        return ApiResult<Guid>.Success(log.Id, 201);
    }

    public async Task<ApiResult<IEnumerable<ContractTaskLogResponseDto>>> GetLogsAsync(Guid taskId)
    {
        // Creator butun User entity'si sifatida emas — faqat ism/familiya ustunlari o'qiladi.
        var logs = await _context.ContractTaskDailyLogs
            .AsNoTracking()
            .Where(l => l.TaskId == taskId)
            .OrderByDescending(l => l.Date)
            .ThenByDescending(l => l.CreatedAt)
            .Select(l => new ContractTaskLogResponseDto
            {
                Id = l.Id,
                Amount = l.Amount,
                CreatedByFullName = l.Creator != null ? l.Creator.FirstName + " " + l.Creator.LastName : null,
                CreatedAt = l.CreatedAt,
            })
            .ToListAsync();

        if (logs.Count == 0 && !await _context.ContractTasks.AnyAsync(t => t.Id == taskId))
            return ApiResult<IEnumerable<ContractTaskLogResponseDto>>.Failure([$"ContractTask with id '{taskId}' not found."], 404);

        return ApiResult<IEnumerable<ContractTaskLogResponseDto>>.Success(logs);
    }

    // ── Scope lock ────────────────────────────────────────────────────────────
    // Yakunlangan yoki bekor qilingan scope vazifalari tarixiy hujjat — ularni
    // qo'shish, o'zgartirish, o'chirish yoki progress kiritish taqiqlanadi.
    // Scope qulflangan hisoblanadi: shartnoma noaktiv/yakunlangan/bekor qilingan,
    // mahsulot yakunlangan/bekor qilingan yoki ombor vazifasi 100% bajarilgan bo'lsa.

    private sealed class ScopeState
    {
        public string ContractNo { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public ContractStatus Status { get; set; }
        public ContractProductStatus? ProductStatus { get; set; }
        public bool ProcessFinished { get; set; }
    }

    // Shartnoma holati, mahsulot holati va ombor vazifasi yakunlanganligi — bitta so'rovda.
    // Shartnoma topilmasa null qaytadi (404 ni chaqiruvchi metodning o'z tekshiruvi hal qiladi).
    private Task<ScopeState?> LoadScopeAsync(Guid contractId, Guid? contractProductId)
    {
        return _context.Contracts
            .AsNoTracking()
            .Where(c => c.Id == contractId)
            .Select(c => new ScopeState
            {
                ContractNo = c.ContractNo,
                IsActive = c.IsActive,
                Status = c.Status,
                // Mahsulot ushbu shartnomaga tegishli bo'lmasa null — tegishlilik tekshiruvi ham shu yerda.
                ProductStatus = _context.ContractProducts
                    .Where(p => p.Id == contractProductId && p.ContractId == contractId)
                    .Select(p => (ContractProductStatus?)p.Status)
                    .FirstOrDefault(),
                ProcessFinished = _context.ContractTasks
                    .Any(t => t.IsActive
                              && t.ContractId == contractId
                              && t.Name == WarehouseTaskName
                              && t.ContractProductId == contractProductId
                              && t.TotalAmount > 0
                              && t.CompletedAmount >= t.TotalAmount),
            })
            .FirstOrDefaultAsync();
    }

    private async Task<string?> GetScopeLockErrorAsync(Guid contractId, Guid? contractProductId)
    {
        var scope = await LoadScopeAsync(contractId, contractProductId);
        return scope is null ? null : GetLockError(scope, contractProductId.HasValue);
    }

    private static string? GetLockError(ScopeState scope, bool hasProduct)
    {
        if (!scope.IsActive || scope.Status == ContractStatus.Cancelled)
            return "Bekor qilingan shartnoma vazifalari ustida amal bajarib bo'lmaydi.";

        if (scope.Status == ContractStatus.Completed)
            return "Yakunlangan shartnoma vazifalari ustida amal bajarib bo'lmaydi.";

        if (hasProduct)
        {
            if (scope.ProductStatus is null)
                return "Tanlangan mahsulot ushbu shartnomaga tegishli emas.";

            if (scope.ProductStatus == ContractProductStatus.Cancelled)
                return "Bekor qilingan mahsulot vazifalari ustida amal bajarib bo'lmaydi.";

            if (scope.ProductStatus == ContractProductStatus.Completed)
                return "Yakunlangan mahsulot vazifalari ustida amal bajarib bo'lmaydi.";
        }

        return scope.ProcessFinished
            ? "Jarayon yakunlangan — barcha mahsulot omborga topshirilgan. Vazifalar ustida amal bajarib bo'lmaydi."
            : null;
    }

    // Warehouse task uchun cap — bir xil scope ichidagi boshqa vazifalarning eng kam
    // CompletedAmount qiymati. Boshqa vazifa yo'q bo'lsa null (cap qo'yilmaydi).
    private Task<decimal?> GetWarehouseCompletedCapAsync(ContractTask warehouseTask)
    {
        return _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.IsActive
                        && t.Id != warehouseTask.Id
                        && t.ContractId == warehouseTask.ContractId
                        && t.Name != WarehouseTaskName
                        && t.ContractProductId == warehouseTask.ContractProductId)
            .MinAsync(t => (decimal?)t.CompletedAmount);
    }
}
