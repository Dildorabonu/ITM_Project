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
        Guid contractId, Guid? contractProductId, ShipmentBatchKind? kind)
    {
        var query = _context.ShipmentBatches
            .Include(s => s.Department)
            .Include(s => s.Creator)
            .Include(s => s.SourceBatch)
            .AsNoTracking()
            .Where(s => s.ContractId == contractId);

        if (contractProductId.HasValue)
            query = query.Where(s => s.ContractProductId == contractProductId.Value);

        if (kind.HasValue)
            query = query.Where(s => s.Kind == kind.Value);

        var batches = await query
            .OrderBy(s => s.BatchNo)
            .ToListAsync();

        return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Success(batches.Select(MapToResponse));
    }

    // Har bir faol mahsulot uchun topshirishga tayyor miqdor — CreateAsync'dagi
    // "ready" hisobi bilan bir xil qoida: ombor vazifasining CompletedAmount'i,
    // vazifa yo'q lekin mahsulot Completed bo'lsa — to'liq miqdor; har doim
    // shartnomadagi miqdor bilan cheklanadi. Tugallanmagan shartnomalarda ham
    // qisman topshirish mumkinligini frontendga ko'rsatish uchun ishlatiladi.
    public async Task<ApiResult<IEnumerable<ShipmentReadyDto>>> GetReadyByContractAsync(Guid contractId)
    {
        var products = await _context.ContractProducts
            .AsNoTracking()
            .Where(p => p.ContractId == contractId
                        && p.IsActive
                        && p.Status != ContractProductStatus.Cancelled)
            .Select(p => new { p.Id, p.Quantity, p.Status })
            .ToListAsync();

        var warehouseTasks = await _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.IsActive
                        && t.ContractId == contractId
                        && t.ContractProductId != null
                        && t.Name == WarehouseTaskName)
            .Select(t => new { ProductId = t.ContractProductId!.Value, t.CompletedAmount })
            .ToListAsync();

        // CreateAsync bilan bir xil: bitta mahsulotga bir nechta vazifa bo'lsa,
        // birinchisi olinadi.
        var warehouseByProduct = warehouseTasks
            .GroupBy(t => t.ProductId)
            .ToDictionary(g => g.Key, g => g.First().CompletedAmount);

        var result = products.Select(p =>
        {
            decimal ready;
            if (warehouseByProduct.TryGetValue(p.Id, out var completed))
                ready = completed;
            else if (p.Status == ContractProductStatus.Completed)
                ready = p.Quantity;
            else
                ready = 0m;

            return new ShipmentReadyDto
            {
                ContractProductId = p.Id,
                ReadyQuantity = Math.Min(ready, p.Quantity),
            };
        });

        return ApiResult<IEnumerable<ShipmentReadyDto>>.Success(result.ToList());
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

        // Mijoz olib ketishi manba partiyaga bog'lansa: partiya shu shartnoma va
        // mahsulotning ishlab chiqarish partiyasi bo'lishi, miqdor esa partiya
        // qoldig'idan (partiya miqdori − undan avval olib ketilganlar) oshmasligi
        // kerak. Bitta partiyadan bir necha marta qisman olib ketish mumkin.
        ShipmentBatch? sourceBatch = null;
        if (dto.SourceBatchId.HasValue)
        {
            if (dto.Kind != ShipmentBatchKind.CustomerPickup)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Manba partiya faqat mijozga topshirishda ko'rsatiladi."]);

            sourceBatch = await _context.ShipmentBatches
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == dto.SourceBatchId.Value);

            if (sourceBatch is null
                || sourceBatch.ContractId != dto.ContractId
                || sourceBatch.Kind != ShipmentBatchKind.Production)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Tanlangan partiya topilmadi yoki ushbu shartnomaga tegishli emas."]);

            if (sourceBatch.ContractProductId != dto.ContractProductId)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Tanlangan partiya boshqa mahsulotga tegishli."]);

            var takenFromSource = await _context.ShipmentBatches
                .Where(s => s.SourceBatchId == sourceBatch.Id)
                .SumAsync(s => (decimal?)s.Amount) ?? 0m;

            var sourceRemaining = sourceBatch.Amount - takenFromSource;
            if (dto.Amount > sourceRemaining)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    [$"Miqdor partiya #{sourceBatch.BatchNo} qoldig'idan oshib ketdi. Qoldiq: {sourceRemaining}."]);
        }

        // Har tur o'z hisobini yuritadi: ishlab chiqarish partiyalari ham,
        // mijoz olib ketishlari ham ombordagi tayyor miqdorga nisbatan
        // tekshiriladi, lekin bir-birining qoldig'ini kamaytirmaydi.
        var alreadyShipped = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == dto.Kind)
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        var available = ready - alreadyShipped;
        if (dto.Amount > available)
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                [$"Miqdor mavjud qoldiqdan oshib ketdi. Mavjud: {available}."]);

        var nextBatchNo = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == dto.Kind)
            .MaxAsync(s => (int?)s.BatchNo) ?? 0;

        var batch = new ShipmentBatch
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            DepartmentId = dto.DepartmentId,
            Kind = dto.Kind,
            SourceBatchId = sourceBatch?.Id,
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
            .Include(s => s.SourceBatch)
            .AsNoTracking()
            .FirstAsync(s => s.Id == batch.Id);

        await _activityLogService.LogAsync(
            kind: "shipment",
            title: created.Kind == ShipmentBatchKind.CustomerPickup
                ? $"Mijozga topshirish #{created.BatchNo} — {created.Amount}"
                : $"Partiya #{created.BatchNo} — {created.Amount}",
            subtitle: created.Contract?.ContractNo,
            actorId: userId,
            refId: created.Id);

        return ApiResult<ShipmentBatchResponseDto>.Success(MapToResponse(created), 201);
    }

    // Katta miqdorni partiyalab bitta-bitta kiritmaslik uchun: umumiy miqdor
    // eng eski partiyadan boshlab (FIFO) avtomatik taqsimlanadi. Har partiyadan
    // olingan qismi alohida yozuv bo'ladi — tarixda qaysi partiyadan qancha
    // ketgani to'liq ko'rinadi. Partiyasi yo'q mahsulotda (masalan, holati
    // qo'lda yakunlangan) bitta bog'lanmagan yozuv yaratiladi.
    public async Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> CreatePickupAutoAsync(
        ShipmentPickupAutoCreateDto dto, Guid userId)
    {
        if (dto.Amount <= 0)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(["Miqdor 0 dan katta bo'lishi kerak."]);

        var contract = await _context.Contracts
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == dto.ContractId);
        if (contract is null)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."], 404);

        ContractProduct? product = null;
        if (dto.ContractProductId.HasValue)
        {
            product = await _context.ContractProducts
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (product is null)
                return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        if (dto.DepartmentId.HasValue)
        {
            var deptOk = await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value);
            if (!deptOk)
                return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure([$"Bo'lim '{dto.DepartmentId}' topilmadi."], 404);
        }

        // Umumiy chegara — CreateAsync bilan bir xil: ombordagi tayyor miqdor
        // minus shu juftlik bo'yicha avval olib ketilganlar.
        var warehouseTask = await _context.ContractTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.IsActive
                                      && t.ContractId == dto.ContractId
                                      && t.ContractProductId == dto.ContractProductId
                                      && t.Name == WarehouseTaskName);

        decimal ready;
        if (warehouseTask is not null)
            ready = warehouseTask.CompletedAmount;
        else if (product is { Status: ContractProductStatus.Completed })
            ready = product.Quantity;
        else
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                ["Ushbu mahsulot uchun ombor vazifasi topilmadi — partiya yaratib bo'lmaydi."]);

        if (product is not null && ready > product.Quantity)
            ready = product.Quantity;

        var alreadyPicked = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == ShipmentBatchKind.CustomerPickup)
            .SumAsync(s => (decimal?)s.Amount) ?? 0m;

        var available = ready - alreadyPicked;
        if (dto.Amount > available)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                [$"Miqdor mavjud qoldiqdan oshib ketdi. Mavjud: {available}."]);

        // Ishlab chiqarish partiyalari — eng eskisidan boshlab taqsimlanadi.
        var sources = await _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == ShipmentBatchKind.Production)
            .OrderBy(s => s.BatchNo)
            .ToListAsync();

        var sourceIds = sources.Select(s => s.Id).ToList();
        var takenBySource = await _context.ShipmentBatches
            .Where(s => s.SourceBatchId != null && sourceIds.Contains(s.SourceBatchId.Value))
            .GroupBy(s => s.SourceBatchId!.Value)
            .Select(g => new { Id = g.Key, Taken = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.Id, x => x.Taken);

        var nextBatchNo = await _context.ShipmentBatches
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == ShipmentBatchKind.CustomerPickup)
            .MaxAsync(s => (int?)s.BatchNo) ?? 0;

        var toCreate = new List<ShipmentBatch>();

        ShipmentBatch NewPickup(decimal amount, Guid? sourceBatchId) => new()
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            DepartmentId = dto.DepartmentId,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = sourceBatchId,
            BatchNo = ++nextBatchNo,
            Amount = amount,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        if (sources.Count == 0)
        {
            toCreate.Add(NewPickup(dto.Amount, null));
        }
        else
        {
            var left = dto.Amount;
            foreach (var src in sources)
            {
                if (left <= 0) break;
                var remaining = src.Amount - takenBySource.GetValueOrDefault(src.Id);
                if (remaining <= 0) continue;
                var take = Math.Min(remaining, left);
                toCreate.Add(NewPickup(take, src.Id));
                left -= take;
            }

            if (left > 0)
                return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                    [$"Partiyalardagi qoldiq yetarli emas. Partiyalarda mavjud: {dto.Amount - left}."]);
        }

        _context.ShipmentBatches.AddRange(toCreate);
        await _context.SaveChangesAsync();

        var createdIds = toCreate.Select(b => b.Id).ToList();
        var created = await _context.ShipmentBatches
            .Include(s => s.Department)
            .Include(s => s.Creator)
            .Include(s => s.SourceBatch)
            .AsNoTracking()
            .Where(s => createdIds.Contains(s.Id))
            .OrderBy(s => s.BatchNo)
            .ToListAsync();

        await _activityLogService.LogAsync(
            kind: "shipment",
            title: toCreate.Count > 1
                ? $"Mijozga topshirish — {dto.Amount} ({toCreate.Count} partiyadan)"
                : $"Mijozga topshirish #{toCreate[0].BatchNo} — {dto.Amount}",
            subtitle: contract.ContractNo,
            actorId: userId,
            refId: toCreate[0].Id);

        return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Success(created.Select(MapToResponse), 201);
    }

    private static ShipmentBatchResponseDto MapToResponse(ShipmentBatch s) => new()
    {
        Id = s.Id,
        ContractProductId = s.ContractProductId,
        Kind = s.Kind,
        SourceBatchId = s.SourceBatchId,
        SourceBatchNo = s.SourceBatch?.BatchNo,
        DepartmentName = s.Department?.Name,
        BatchNo = s.BatchNo,
        Amount = s.Amount,
        CreatedByFullName = s.Creator is null ? null : $"{s.Creator.FirstName} {s.Creator.LastName}".Trim(),
        CreatedAt = s.CreatedAt,
    };
}
