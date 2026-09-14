using Application.DTOs;
using Application.DTOs.ManufacturedProducts;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using SysTask = System.Threading.Tasks.Task;

namespace Application.Services.Impl;

public class ManufacturedProductService : IManufacturedProductService
{
    private readonly DatabaseContext _context;
    private readonly IActivityLogService _activityLogService;

    // Tasks page-da har bir mahsulot uchun avtomatik yaratiladigan ombor vazifasining nomi.
    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    public ManufacturedProductService(DatabaseContext context, IActivityLogService activityLogService)
    {
        _context = context;
        _activityLogService = activityLogService;
    }

    // ─── Read operations ─────────────────────────────────────────────────────

    public async Task<ApiResult<PagedResult<ManufacturedProductResponseDto>>> GetAllAsync(
        int page, int pageSize, string? search, Guid? departmentId, ManufacturingStatus? status)
    {
        var query = _context.ManufacturedProducts
            .AsNoTracking()
            // Auto-derived (ContractProductId != null) yoki qo'lda kiritilgan (kontraktga
            // umuman bog'lanmagan) yozuvlar — orphan auto-rows ko'rinmasligi uchun aniq filter.
            .Where(p => p.ContractProductId != null || p.ContractId == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(lower) ||
                (p.Code != null && p.Code.ToLower().Contains(lower)) ||
                (p.Description != null && p.Description.ToLower().Contains(lower)) ||
                (p.Department != null && p.Department.Name.ToLower().Contains(lower)) ||
                (p.Contract != null && p.Contract.ContractNo.ToLower().Contains(lower)));
        }

        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        if (status.HasValue)
            query = query.Where(p => p.Status == status.Value);

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        // Include o'rniga to'g'ridan-to'g'ri proyeksiya: Department va Contract
        // entity'lari to'liq o'qilmaydi — ulardan faqat bitta ustun olinadi.
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(p => new ManufacturedProductResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Description = p.Description,
                Quantity = p.Quantity,
                ProducedQuantity = p.ProducedQuantity,
                Unit = p.Unit,
                Status = p.Status,
                DepartmentId = p.DepartmentId,
                DepartmentName = p.Department != null ? p.Department.Name : string.Empty,
                ContractId = p.ContractId,
                ContractProductId = p.ContractProductId,
                ContractNo = p.Contract != null ? p.Contract.ContractNo : null,
                StartedAt = p.StartedAt,
                CompletedAt = p.CompletedAt,
                Notes = p.Notes,
                CreatedAt = p.CreatedAt,
            })
            .ToListAsync();

        var paged = PagedResult<ManufacturedProductResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ManufacturedProductResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<ManufacturedProductStatsDto>> GetStatsAsync()
    {
        var grouped = await _context.ManufacturedProducts
            .AsNoTracking()
            .Where(p => p.ContractProductId != null || p.ContractId == null)
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var stats = new ManufacturedProductStatsDto
        {
            Total = grouped.Sum(x => x.Count),
            InProgress = grouped.FirstOrDefault(x => x.Status == ManufacturingStatus.InProgress)?.Count ?? 0,
            Completed = grouped.FirstOrDefault(x => x.Status == ManufacturingStatus.Completed)?.Count ?? 0,
        };

        return ApiResult<ManufacturedProductStatsDto>.Success(stats);
    }

    // ─── Write operations ────────────────────────────────────────────────────
    // Faqat qo'lda kiritilgan yozuvlar uchun (ContractProductId == null). Auto-derived
    // yozuvlar shartnoma jarayoni orqali boshqariladi va to'g'ridan-to'g'ri tahrir/o'chirish
    // qilib bo'lmaydi.

    public async Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<int>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);

        if (dto.DepartmentId == Guid.Empty)
            return ApiResult<int>.Failure(["Bo'lim tanlanishi shart."]);

        // Bo'lim mavjudligini tekshirish va uning nomini olish — bitta so'rovda
        // (avval Any + keyin Select bilan ikki marta so'ralar edi).
        var departmentName = await _context.Departments
            .AsNoTracking()
            .Where(d => d.Id == dto.DepartmentId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync();

        if (departmentName is null)
            return ApiResult<int>.Failure(["Tanlangan bo'lim topilmadi."]);

        if (dto.Quantity < 0 || dto.ProducedQuantity < 0)
            return ApiResult<int>.Failure(["Miqdor manfiy bo'lishi mumkin emas."]);

        if (dto.ProducedQuantity > dto.Quantity)
            return ApiResult<int>.Failure(["Bajarilgan miqdor umumiy miqdordan ko'p bo'lishi mumkin emas."]);

        var status = dto.ProducedQuantity >= dto.Quantity && dto.Quantity > 0
            ? ManufacturingStatus.Completed
            : dto.Status;

        var entity = new ManufacturedProduct
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Code = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Quantity = dto.Quantity,
            ProducedQuantity = dto.ProducedQuantity,
            Unit = dto.Unit,
            Status = status,
            DepartmentId = dto.DepartmentId,
            // Qo'lda kiritilgan yozuv hech qachon shartnomaga bog'lanmaydi —
            // GetAllAsync filter va sync mantig'i shu qoidaga tayanadi.
            ContractId = null,
            ContractProductId = null,
            StartedAt = dto.StartedAt,
            CompletedAt = status == ManufacturingStatus.Completed
                ? dto.CompletedAt ?? DateTime.UtcNow
                : null,
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ManufacturedProducts.Add(entity);
        await _context.SaveChangesAsync();

        await _activityLogService.LogAsync(
            kind: "manufactured",
            title: $"Ishlab chiq.: {entity.Name}",
            subtitle: departmentName,
            actorId: userId,
            refId: entity.Id);

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto)
    {
        var entity = await _context.ManufacturedProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null)
            return ApiResult<int>.Failure([$"Tayyor mahsulot '{id}' topilmadi."]);

        if (entity.ContractProductId != null)
            return ApiResult<int>.Failure(
                ["Bu yozuv shartnoma vazifalaridan avtomatik boshqariladi — qo'lda tahrirlab bo'lmaydi."]);

        if (dto.Name != null)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return ApiResult<int>.Failure(["Mahsulot nomi bo'sh bo'lishi mumkin emas."]);
            entity.Name = dto.Name.Trim();
        }

        if (dto.Code != null)
            entity.Code = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim();

        if (dto.Description != null)
            entity.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();

        if (dto.Quantity.HasValue)
        {
            if (dto.Quantity.Value < 0)
                return ApiResult<int>.Failure(["Miqdor manfiy bo'lishi mumkin emas."]);
            entity.Quantity = dto.Quantity.Value;
        }

        if (dto.ProducedQuantity.HasValue)
        {
            if (dto.ProducedQuantity.Value < 0)
                return ApiResult<int>.Failure(["Bajarilgan miqdor manfiy bo'lishi mumkin emas."]);
            entity.ProducedQuantity = dto.ProducedQuantity.Value;
        }

        if (entity.ProducedQuantity > entity.Quantity)
            return ApiResult<int>.Failure(["Bajarilgan miqdor umumiy miqdordan ko'p bo'lishi mumkin emas."]);

        if (dto.Unit.HasValue)
            entity.Unit = dto.Unit.Value;

        if (dto.DepartmentId.HasValue)
        {
            if (dto.DepartmentId.Value == Guid.Empty)
                return ApiResult<int>.Failure(["Bo'lim tanlanishi shart."]);
            var departmentExists = await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value);
            if (!departmentExists)
                return ApiResult<int>.Failure(["Tanlangan bo'lim topilmadi."]);
            entity.DepartmentId = dto.DepartmentId.Value;
        }

        if (dto.Status.HasValue)
            entity.Status = dto.Status.Value;

        // Auto-finalize: agar bajarilgan miqdor umumiyga teng bo'lsa, holatni Completed ga o'tkazamiz.
        if (entity.Quantity > 0 && entity.ProducedQuantity >= entity.Quantity)
            entity.Status = ManufacturingStatus.Completed;

        if (dto.StartedAt != null)
            entity.StartedAt = dto.StartedAt;

        if (dto.CompletedAt != null)
            entity.CompletedAt = dto.CompletedAt;

        if (entity.Status == ManufacturingStatus.Completed && entity.CompletedAt is null)
            entity.CompletedAt = DateTime.UtcNow;
        else if (entity.Status != ManufacturingStatus.Completed)
            entity.CompletedAt = null;

        if (dto.Notes != null)
            entity.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var entity = await _context.ManufacturedProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null)
            return ApiResult<int>.Failure([$"Tayyor mahsulot '{id}' topilmadi."]);

        if (entity.ContractProductId != null)
            return ApiResult<int>.Failure(
                ["Bu yozuv shartnoma vazifalaridan avtomatik boshqariladi — qo'lda o'chirib bo'lmaydi."]);

        _context.ManufacturedProducts.Remove(entity);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    // ─── Sync ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Shartnoma ostidagi har bir mahsulot uchun ManufacturedProducts jadvalini yangilaydi.
    /// Mahsulot o'z statusiga qarab kiritiladi — kontrakt umumiy holati emas:
    /// — Mahsulot status InProduction yoki Completed bo'lsa → yozuv qo'shiladi/yangilanadi.
    /// — Boshqa holatlarda (DrawingPending/TechProcessing/Cancelled yoki kontrakt nofaol) → yozuv o'chiriladi.
    /// Yoziladigan ManufacturedProducts'dan boshqa hamma narsa AsNoTracking proyeksiya
    /// bilan o'qiladi — change tracker faqat haqiqatan o'zgaradigan qatorlarni ko'radi.
    /// </summary>
    public async SysTask SyncForContractAsync(Guid contractId)
    {
        var contract = await _context.Contracts
            .AsNoTracking()
            .Where(c => c.Id == contractId)
            .Select(c => new { c.IsActive, c.Status, c.ContractNo, c.CreatedAt, c.CreatedBy })
            .FirstOrDefaultAsync();

        if (contract is null) return;

        var existingRows = await _context.ManufacturedProducts
            .Where(p => p.ContractId == contractId && p.ContractProductId != null)
            .ToListAsync();

        // Kontrakt o'chirilgan / bekor qilingan — barcha yozuvlarni o'chiramiz.
        if (!contract.IsActive || contract.Status == ContractStatus.Cancelled)
        {
            await RemoveRowsAsync(existingRows);
            return;
        }

        // Ishlab chiqarish bo'limi ustuvor, bo'lmasa — birinchi aktiv bo'lim.
        var department = await _context.ContractDepartments
            .AsNoTracking()
            .Where(cd => cd.ContractId == contractId && cd.IsActive)
            .OrderBy(cd => cd.Department.Type == DepartmentType.IshlabChiqarish ? 0 : 1)
            .Select(cd => new { cd.DepartmentId, cd.Department.Name })
            .FirstOrDefaultAsync();

        if (department is null)
        {
            // Bo'limsiz — yozuv yarata olmaymiz. Mavjudlarni ham o'chirib tashlaymiz.
            await RemoveRowsAsync(existingRows);
            return;
        }

        // Faqat InProduction/Completed mahsulotlari ko'rinadi — filtr SQL tomonda
        // bajariladi, kontraktning barcha mahsulotlari xotiraga tortilmaydi.
        var products = await _context.ContractProducts
            .AsNoTracking()
            .Where(p => p.ContractId == contractId && p.IsActive
                        && (p.Status == ContractProductStatus.InProduction
                            || p.Status == ContractProductStatus.Completed))
            .Select(p => new { p.Id, p.Status, p.ProductType, p.Notes, p.Quantity, p.Unit })
            .ToListAsync();

        // Vazifalardan faqat ikki narsa kerak: ombor topshirish miqdori va eng erta
        // vazifa sanasi. Shu sabab ContractTasks to'liq emas, ustunlar bo'yicha o'qiladi.
        var warehouseAmounts = new Dictionary<Guid, decimal>();
        var firstTaskAt = new Dictionary<Guid, DateTime>();

        if (products.Count > 0)
        {
            var productIds = products.Select(p => p.Id).ToList();
            var tasks = await _context.ContractTasks
                .AsNoTracking()
                .Where(t => t.IsActive && t.ContractId == contractId
                            && t.ContractProductId != null
                            && productIds.Contains(t.ContractProductId.Value))
                .Select(t => new
                {
                    ProductId = t.ContractProductId!.Value,
                    IsWarehouse = t.Name == WarehouseTaskName,
                    t.CompletedAmount,
                    t.CreatedAt,
                })
                .ToListAsync();

            foreach (var t in tasks)
            {
                if (t.IsWarehouse)
                    warehouseAmounts.TryAdd(t.ProductId, t.CompletedAmount);

                if (!firstTaskAt.TryGetValue(t.ProductId, out var earliest) || t.CreatedAt < earliest)
                    firstTaskAt[t.ProductId] = t.CreatedAt;
            }
        }

        var existingByProductId = existingRows.ToDictionary(r => r.ContractProductId!.Value);
        var keepRowIds = new HashSet<Guid>();
        var newlyCreated = new List<ManufacturedProduct>();

        foreach (var product in products)
        {
            var derivedStatus = product.Status == ContractProductStatus.Completed
                ? ManufacturingStatus.Completed
                : ManufacturingStatus.InProgress;

            if (!Enum.TryParse<ProductUnit>(product.Unit, ignoreCase: true, out var unit))
                unit = ProductUnit.Dona;

            var hasWarehouseTask = warehouseAmounts.TryGetValue(product.Id, out var producedQuantity);
            if (!hasWarehouseTask && product.Status == ContractProductStatus.Completed)
                producedQuantity = product.Quantity;

            DateTime? startedAt = firstTaskAt.TryGetValue(product.Id, out var first) ? first : null;

            if (existingByProductId.TryGetValue(product.Id, out var row))
            {
                // Mavjud yozuvni yangilaymiz
                row.Name = product.ProductType;
                row.Code = contract.ContractNo;
                row.Description = product.Notes;
                // Notes Description bilan bir xil matn edi — UI da izoh ikki marta
                // ko'rinardi. Auto-derived yozuvda u faqat Description orqali uzatiladi.
                row.Notes = null;
                row.Quantity = product.Quantity;
                row.ProducedQuantity = producedQuantity;
                row.Unit = unit;
                row.Status = derivedStatus;
                row.DepartmentId = department.DepartmentId;
                row.ContractId = contractId;
                row.StartedAt = startedAt ?? row.StartedAt ?? contract.CreatedAt;
                row.CompletedAt = derivedStatus == ManufacturingStatus.Completed
                    ? row.CompletedAt ?? DateTime.UtcNow
                    : null;
                keepRowIds.Add(row.Id);
            }
            else
            {
                // Yangi yozuv qo'shamiz
                var newRow = new ManufacturedProduct
                {
                    Id = Guid.NewGuid(),
                    Name = product.ProductType,
                    Code = contract.ContractNo,
                    Description = product.Notes,
                    Quantity = product.Quantity,
                    ProducedQuantity = producedQuantity,
                    Unit = unit,
                    Status = derivedStatus,
                    DepartmentId = department.DepartmentId,
                    ContractId = contractId,
                    ContractProductId = product.Id,
                    StartedAt = startedAt ?? contract.CreatedAt,
                    CompletedAt = derivedStatus == ManufacturingStatus.Completed ? DateTime.UtcNow : null,
                    CreatedBy = contract.CreatedBy,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.ManufacturedProducts.Add(newRow);
                newlyCreated.Add(newRow);
            }
        }

        // Tasdiqlanmagan / olib tashlangan mahsulotlarning yozuvlarini o'chiramiz
        var rowsToRemove = existingRows.Where(r => !keepRowIds.Contains(r.Id)).ToList();
        if (rowsToRemove.Count > 0)
            _context.ManufacturedProducts.RemoveRange(rowsToRemove);

        await _context.SaveChangesAsync();

        foreach (var row in newlyCreated)
        {
            await _activityLogService.LogAsync(
                kind: "manufactured",
                title: $"Ishlab chiq.: {row.Name}",
                subtitle: department.Name,
                actorId: row.CreatedBy,
                refId: row.Id);
        }
    }

    private async SysTask RemoveRowsAsync(List<ManufacturedProduct> rows)
    {
        if (rows.Count == 0) return;
        _context.ManufacturedProducts.RemoveRange(rows);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Vazifa progress logi yoki update qilinganda chaqiriladi — tegishli mahsulotning
    /// ProducedQuantity-ni jonli yangilaydi va ombor topshirish 100% ga yetsa
    /// ContractProduct.Status'ni Completed ga o'tkazib, shartnoma umumiy holatini
    /// qayta hisoblaydi.
    /// </summary>
    public async SysTask UpdateProducedQuantityAsync(Guid contractId, Guid? contractProductId)
    {
        if (contractProductId is null) return;

        var row = await _context.ManufacturedProducts
            .FirstOrDefaultAsync(p => p.ContractProductId == contractProductId.Value);
        if (row is null) return;

        // Vazifadan faqat ikkita miqdor kerak — entity change tracker'ga tortilmaydi.
        var warehouseTask = await _context.ContractTasks
            .AsNoTracking()
            .Where(t => t.IsActive
                        && t.ContractId == contractId
                        && t.ContractProductId == contractProductId.Value
                        && t.Name == WarehouseTaskName)
            .Select(t => new { t.CompletedAmount, t.TotalAmount })
            .FirstOrDefaultAsync();

        if (warehouseTask is null) return;

        row.ProducedQuantity = warehouseTask.CompletedAmount;

        // Ombor topshirish to'liq bajarilganda mahsulot Completed ga o'tadi.
        // Bu yagona joy bo'lib, bunda ContractProduct, ManufacturedProduct va Contract
        // statuslari atom tarzda sinxronlanadi.
        var fullyDelivered = warehouseTask.TotalAmount > 0
                             && warehouseTask.CompletedAmount >= warehouseTask.TotalAmount;

        if (fullyDelivered)
        {
            var product = await _context.ContractProducts
                .FirstOrDefaultAsync(p => p.Id == contractProductId.Value);

            if (product is not null && product.Status == ContractProductStatus.InProduction)
            {
                product.Status = ContractProductStatus.Completed;
                row.Status = ManufacturingStatus.Completed;
                row.CompletedAt ??= DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await ContractStatusHelper.RecomputeContractStatusAsync(_context, contractId);
                await _context.SaveChangesAsync();

                await _activityLogService.LogAsync(
                    kind: "manufactured",
                    title: $"Yakunlandi: {row.Name}",
                    subtitle: row.Code,
                    actorId: null,
                    refId: row.Id);
                return;
            }
        }

        await _context.SaveChangesAsync();
    }
}
