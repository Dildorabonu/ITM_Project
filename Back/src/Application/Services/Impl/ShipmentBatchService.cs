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

    // Javob bevosita SQL'da yig'iladi — bog'liq jadvallardan faqat kerakli
    // ustunlar (bo'lim nomi, yaratuvchi ismi, manba partiya raqami) o'qiladi.
    public async Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> GetByContractAsync(
        Guid contractId, Guid? contractProductId, ShipmentBatchKind? kind)
    {
        var query = _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.ContractId == contractId);

        if (contractProductId.HasValue)
            query = query.Where(s => s.ContractProductId == contractProductId.Value);

        if (kind.HasValue)
            query = query.Where(s => s.Kind == kind.Value);

        var batches = await query
            .OrderBy(s => s.BatchNo)
            .Select(s => new ShipmentBatchResponseDto
            {
                Id = s.Id,
                ContractProductId = s.ContractProductId,
                SourceBatchId = s.SourceBatchId,
                SourceBatchNo = s.SourceBatch != null ? s.SourceBatch.BatchNo : null,
                DepartmentName = s.Department != null ? s.Department.Name : null,
                BatchNo = s.BatchNo,
                Amount = s.Amount,
                CreatedByFullName = s.Creator != null
                    ? (s.Creator.FirstName + " " + s.Creator.LastName).Trim()
                    : null,
                CreatedAt = s.CreatedAt,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Success(batches);
    }

    // Har bir faol mahsulot uchun topshirishga tayyor miqdor — CreateAsync'dagi
    // "ready" hisobi bilan bir xil qoida: ombor vazifasining CompletedAmount'i,
    // vazifa yo'q lekin mahsulot Completed bo'lsa — to'liq miqdor; har doim
    // shartnomadagi miqdor bilan cheklanadi. Tugallanmagan shartnomalarda ham
    // qisman topshirish mumkinligini frontendga ko'rsatish uchun ishlatiladi.
    public async Task<ApiResult<IEnumerable<ShipmentReadyDto>>> GetReadyByContractAsync(Guid contractId)
    {
        // Ombor vazifasi mahsulot qatoriga bitta so'rovda biriktiriladi — bir
        // nechta vazifa bo'lsa birinchisi olinadi (CreateAsync bilan bir xil).
        var rows = await _context.ContractProducts
            .AsNoTracking()
            .Where(p => p.ContractId == contractId
                        && p.IsActive
                        && p.Status != ContractProductStatus.Cancelled)
            .Select(p => new
            {
                p.Id,
                p.Quantity,
                p.Status,
                Completed = _context.ContractTasks
                    .Where(t => t.IsActive
                                && t.ContractId == contractId
                                && t.ContractProductId == p.Id
                                && t.Name == WarehouseTaskName)
                    .Select(t => (decimal?)t.CompletedAmount)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        var result = rows.Select(p => new ShipmentReadyDto
        {
            ContractProductId = p.Id,
            ReadyQuantity = Math.Min(
                p.Completed ?? (p.Status == ContractProductStatus.Completed ? p.Quantity : 0m),
                p.Quantity),
        }).ToList();

        return ApiResult<IEnumerable<ShipmentReadyDto>>.Success(result);
    }

    public async Task<ApiResult<ShipmentBatchResponseDto>> CreateAsync(ShipmentBatchCreateDto dto, Guid userId)
    {
        if (dto.Amount <= 0)
            return ApiResult<ShipmentBatchResponseDto>.Failure(["Miqdor 0 dan katta bo'lishi kerak."]);

        // Shartnoma raqami faoliyat jurnali uchun kerak — mavjudlik tekshiruvi
        // bilan bitta so'rovda olinadi.
        var contract = await _context.Contracts
            .Where(c => c.Id == dto.ContractId)
            .Select(c => new { c.ContractNo })
            .FirstOrDefaultAsync();
        if (contract is null)
            return ApiResult<ShipmentBatchResponseDto>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."], 404);

        var product = dto.ContractProductId.HasValue
            ? await _context.ContractProducts
                .Where(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId)
                .Select(p => new { p.Quantity, p.Status })
                .FirstOrDefaultAsync()
            : null;
        if (dto.ContractProductId.HasValue && product is null)
            return ApiResult<ShipmentBatchResponseDto>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);

        // Bo'lim nomi javobda ko'rsatiladi — mavjudlik tekshiruvi bilan birga olinadi.
        string? departmentName = null;
        if (dto.DepartmentId.HasValue)
        {
            var department = await _context.Departments
                .Where(d => d.Id == dto.DepartmentId.Value)
                .Select(d => new { d.Name })
                .FirstOrDefaultAsync();
            if (department is null)
                return ApiResult<ShipmentBatchResponseDto>.Failure([$"Bo'lim '{dto.DepartmentId}' topilmadi."], 404);
            departmentName = department.Name;
        }

        // Tayyor miqdor: odatda ombor vazifasining CompletedAmount'i. Vazifa yo'q,
        // lekin mahsulot Completed bo'lsa (masalan, holat qo'lda o'tkazilgan) —
        // to'liq miqdor omborda deb hisoblanadi, aks holda partiya yaratilmaydi.
        var warehouseCompleted = await _context.ContractTasks
            .Where(t => t.IsActive
                        && t.ContractId == dto.ContractId
                        && t.ContractProductId == dto.ContractProductId
                        && t.Name == WarehouseTaskName)
            .Select(t => (decimal?)t.CompletedAmount)
            .FirstOrDefaultAsync();

        decimal ready;
        if (warehouseCompleted.HasValue)
            ready = warehouseCompleted.Value;
        else if (product is { Status: ContractProductStatus.Completed })
            ready = product.Quantity;
        else
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                ["Ushbu mahsulot uchun ombor vazifasi topilmadi — partiya yaratib bo'lmaydi."]);

        // Shartnomadagi mahsulot miqdori — jo'natmalar uchun mutlaq yuqori chegara.
        if (product is not null && ready > product.Quantity)
            ready = product.Quantity;

        // Mijozga faqat jo'natma qilingan mahsulot beriladi: har olib ketish
        // o'z ishlab chiqarish partiyasiga bog'lanadi, partiya shu shartnoma va
        // mahsulotniki bo'lishi, miqdor esa partiya qoldig'idan (partiya miqdori
        // − undan avval olib ketilganlar) oshmasligi kerak. Bitta partiyadan bir
        // necha marta qisman olib ketish mumkin.
        Guid? sourceBatchId = null;
        int? sourceBatchNo = null;
        if (dto.Kind == ShipmentBatchKind.CustomerPickup && !dto.SourceBatchId.HasValue)
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                ["Mijozga faqat jo'natma partiyasidan topshirish mumkin — manba partiyani tanlang."]);

        if (dto.SourceBatchId.HasValue)
        {
            if (dto.Kind != ShipmentBatchKind.CustomerPickup)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Manba partiya faqat mijozga topshirishda ko'rsatiladi."]);

            // Partiya va uning qoldig'i — bitta so'rovda.
            var source = await _context.ShipmentBatches
                .AsNoTracking()
                .Where(s => s.Id == dto.SourceBatchId.Value)
                .Select(s => new
                {
                    s.Id,
                    s.ContractId,
                    s.ContractProductId,
                    s.Kind,
                    s.BatchNo,
                    Remaining = s.Amount - (_context.ShipmentBatches
                        .Where(x => x.SourceBatchId == s.Id)
                        .Sum(x => (decimal?)x.Amount) ?? 0m),
                })
                .FirstOrDefaultAsync();

            if (source is null
                || source.ContractId != dto.ContractId
                || source.Kind != ShipmentBatchKind.Production)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Tanlangan partiya topilmadi yoki ushbu shartnomaga tegishli emas."]);

            if (source.ContractProductId != dto.ContractProductId)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    ["Tanlangan partiya boshqa mahsulotga tegishli."]);

            if (dto.Amount > source.Remaining)
                return ApiResult<ShipmentBatchResponseDto>.Failure(
                    [$"Miqdor partiya #{source.BatchNo} qoldig'idan oshib ketdi. Qoldiq: {source.Remaining}."]);

            sourceBatchId = source.Id;
            sourceBatchNo = source.BatchNo;
        }

        // Har tur o'z hisobini yuritadi: ishlab chiqarish partiyalari ham,
        // mijoz olib ketishlari ham ombordagi tayyor miqdorga nisbatan
        // tekshiriladi, lekin bir-birining qoldig'ini kamaytirmaydi. Jo'natilgan
        // jami va oxirgi partiya raqami bitta agregat so'rovda olinadi.
        var (shipped, maxBatchNo) = await GetKindStatsAsync(dto.ContractId, dto.ContractProductId, dto.Kind);

        var available = ready - shipped;
        if (dto.Amount > available)
            return ApiResult<ShipmentBatchResponseDto>.Failure(
                [$"Miqdor mavjud qoldiqdan oshib ketdi. Mavjud: {available}."]);

        var batch = new ShipmentBatch
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            DepartmentId = dto.DepartmentId,
            Kind = dto.Kind,
            SourceBatchId = sourceBatchId,
            BatchNo = maxBatchNo + 1,
            Amount = dto.Amount,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ShipmentBatches.Add(batch);
        await _context.SaveChangesAsync();

        await _activityLogService.LogAsync(
            kind: "shipment",
            title: batch.Kind == ShipmentBatchKind.CustomerPickup
                ? $"Mijozga topshirish #{batch.BatchNo} — {batch.Amount}"
                : $"Partiya #{batch.BatchNo} — {batch.Amount}",
            subtitle: contract.ContractNo,
            actorId: userId,
            refId: batch.Id);

        // Javob yozuvni qayta o'qimasdan yig'iladi — bog'liq maydonlar yuqorida
        // allaqachon olingan, faqat yaratuvchining ismi qoladi.
        var creatorName = await GetUserFullNameAsync(userId);

        return ApiResult<ShipmentBatchResponseDto>.Success(
            ToResponse(batch, sourceBatchNo, departmentName, creatorName), 201);
    }

    // Katta miqdorni partiyalab bitta-bitta kiritmaslik uchun: umumiy miqdor
    // eng eski partiyadan boshlab (FIFO) avtomatik taqsimlanadi. Har partiyadan
    // olingan qismi alohida yozuv bo'ladi — tarixda qaysi partiyadan qancha
    // ketgani to'liq ko'rinadi.
    public async Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> CreatePickupAutoAsync(
        ShipmentPickupAutoCreateDto dto, Guid userId)
    {
        if (dto.Amount <= 0)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(["Miqdor 0 dan katta bo'lishi kerak."]);

        var contract = await _context.Contracts
            .Where(c => c.Id == dto.ContractId)
            .Select(c => new { c.ContractNo })
            .FirstOrDefaultAsync();
        if (contract is null)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."], 404);

        var product = dto.ContractProductId.HasValue
            ? await _context.ContractProducts
                .Where(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId)
                .Select(p => new { p.Quantity, p.Status })
                .FirstOrDefaultAsync()
            : null;
        if (dto.ContractProductId.HasValue && product is null)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);

        string? departmentName = null;
        if (dto.DepartmentId.HasValue)
        {
            var department = await _context.Departments
                .Where(d => d.Id == dto.DepartmentId.Value)
                .Select(d => new { d.Name })
                .FirstOrDefaultAsync();
            if (department is null)
                return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure([$"Bo'lim '{dto.DepartmentId}' topilmadi."], 404);
            departmentName = department.Name;
        }

        // Umumiy chegara — CreateAsync bilan bir xil: ombordagi tayyor miqdor
        // minus shu juftlik bo'yicha avval olib ketilganlar.
        var warehouseCompleted = await _context.ContractTasks
            .Where(t => t.IsActive
                        && t.ContractId == dto.ContractId
                        && t.ContractProductId == dto.ContractProductId
                        && t.Name == WarehouseTaskName)
            .Select(t => (decimal?)t.CompletedAmount)
            .FirstOrDefaultAsync();

        decimal ready;
        if (warehouseCompleted.HasValue)
            ready = warehouseCompleted.Value;
        else if (product is { Status: ContractProductStatus.Completed })
            ready = product.Quantity;
        else
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                ["Ushbu mahsulot uchun ombor vazifasi topilmadi — partiya yaratib bo'lmaydi."]);

        if (product is not null && ready > product.Quantity)
            ready = product.Quantity;

        var (picked, maxBatchNo) = await GetKindStatsAsync(
            dto.ContractId, dto.ContractProductId, ShipmentBatchKind.CustomerPickup);

        var available = ready - picked;
        if (dto.Amount > available)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                [$"Miqdor mavjud qoldiqdan oshib ketdi. Mavjud: {available}."]);

        // Ishlab chiqarish partiyalari qoldig'i bilan birga — eng eskisidan
        // boshlab taqsimlanadi.
        var sources = await _context.ShipmentBatches
            .AsNoTracking()
            .Where(s => s.ContractId == dto.ContractId
                        && s.ContractProductId == dto.ContractProductId
                        && s.Kind == ShipmentBatchKind.Production)
            .OrderBy(s => s.BatchNo)
            .Select(s => new
            {
                s.Id,
                s.BatchNo,
                Remaining = s.Amount - (_context.ShipmentBatches
                    .Where(x => x.SourceBatchId == s.Id)
                    .Sum(x => (decimal?)x.Amount) ?? 0m),
            })
            .ToListAsync();

        var nextBatchNo = maxBatchNo;
        var toCreate = new List<(ShipmentBatch Batch, int? SourceBatchNo)>();

        ShipmentBatch NewPickup(decimal amount, Guid? sourceId) => new()
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            DepartmentId = dto.DepartmentId,
            Kind = ShipmentBatchKind.CustomerPickup,
            SourceBatchId = sourceId,
            BatchNo = ++nextBatchNo,
            Amount = amount,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        // Jo'natma partiyasi bo'lmasa mahsulot hali mijozga chiqmagan — olib
        // ketishni bog'lanmagan yozuv sifatida qayd etib bo'lmaydi.
        if (sources.Count == 0)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                ["Ushbu mahsulot bo'yicha jo'natma partiyasi yo'q — mijozga topshirib bo'lmaydi."]);

        var left = dto.Amount;
        foreach (var src in sources)
        {
            if (left <= 0) break;
            if (src.Remaining <= 0) continue;
            var take = Math.Min(src.Remaining, left);
            toCreate.Add((NewPickup(take, src.Id), src.BatchNo));
            left -= take;
        }

        if (left > 0)
            return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Failure(
                [$"Partiyalardagi qoldiq yetarli emas. Partiyalarda mavjud: {dto.Amount - left}."]);

        _context.ShipmentBatches.AddRange(toCreate.Select(x => x.Batch));
        await _context.SaveChangesAsync();

        await _activityLogService.LogAsync(
            kind: "shipment",
            title: toCreate.Count > 1
                ? $"Mijozga topshirish — {dto.Amount} ({toCreate.Count} partiyadan)"
                : $"Mijozga topshirish #{toCreate[0].Batch.BatchNo} — {dto.Amount}",
            subtitle: contract.ContractNo,
            actorId: userId,
            refId: toCreate[0].Batch.Id);

        var creatorName = await GetUserFullNameAsync(userId);

        // Yozuvlar BatchNo o'sish tartibida yaratilgan — qayta o'qish va
        // saralash shart emas.
        var created = toCreate
            .Select(x => ToResponse(x.Batch, x.SourceBatchNo, departmentName, creatorName))
            .ToList();

        return ApiResult<IEnumerable<ShipmentBatchResponseDto>>.Success(created, 201);
    }

    // Shu (shartnoma, mahsulot, tur) juftligi bo'yicha jo'natilgan jami miqdor
    // va oxirgi partiya raqami — bitta agregat so'rov.
    private async Task<(decimal Shipped, int MaxBatchNo)> GetKindStatsAsync(
        Guid contractId, Guid? contractProductId, ShipmentBatchKind kind)
    {
        var stats = await _context.ShipmentBatches
            .Where(s => s.ContractId == contractId
                        && s.ContractProductId == contractProductId
                        && s.Kind == kind)
            .GroupBy(_ => 1)
            .Select(g => new { Shipped = g.Sum(x => x.Amount), MaxBatchNo = g.Max(x => x.BatchNo) })
            .FirstOrDefaultAsync();

        return (stats?.Shipped ?? 0m, stats?.MaxBatchNo ?? 0);
    }

    private async Task<string?> GetUserFullNameAsync(Guid userId)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.FirstName, u.LastName })
            .FirstOrDefaultAsync();

        return user is null ? null : $"{user.FirstName} {user.LastName}".Trim();
    }

    private static ShipmentBatchResponseDto ToResponse(
        ShipmentBatch s, int? sourceBatchNo, string? departmentName, string? creatorName) => new()
    {
        Id = s.Id,
        ContractProductId = s.ContractProductId,
        SourceBatchId = s.SourceBatchId,
        SourceBatchNo = sourceBatchNo,
        DepartmentName = departmentName,
        BatchNo = s.BatchNo,
        Amount = s.Amount,
        CreatedByFullName = creatorName,
        CreatedAt = s.CreatedAt,
    };
}
