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
            .Include(p => p.Department)
            .Include(p => p.Contract)
            .Include(p => p.Creator)
            .AsNoTracking()
            // Auto-derived (ContractProductId != null) yoki qo'lda kiritilgan (kontraktga
            // umuman bog'lanmagan) yozuvlar — orphan auto-rows ko'rinmasligi uchun aniq filter.
            .Where(p => p.ContractProductId != null || p.ContractId == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLower();
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
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var paged = PagedResult<ManufacturedProductResponseDto>.Create(items.Select(MapToResponse), totalCount, pagination);
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

    public async Task<ApiResult<ManufacturedProductResponseDto>> GetByIdAsync(Guid id)
    {
        var product = await _context.ManufacturedProducts
            .Include(p => p.Department)
            .Include(p => p.Contract)
            .Include(p => p.Creator)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<ManufacturedProductResponseDto>.Failure([$"Manufactured product with id '{id}' not found."]);

        return ApiResult<ManufacturedProductResponseDto>.Success(MapToResponse(product));
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

        var departmentExists = await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId);
        if (!departmentExists)
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

        var departmentName = await _context.Departments
            .AsNoTracking()
            .Where(d => d.Id == entity.DepartmentId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync();

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
    /// Endi mahsulot o'z statusiga qarab kiritiladi — kontrakt umumiy holati emas:
    /// — Mahsulot status InProduction yoki Completed bo'lsa → yozuv qo'shiladi/yangilanadi.
    /// — Boshqa holatlarda (DrawingPending/TechProcessing/Cancelled yoki kontrakt nofaol) → yozuv o'chiriladi.
    /// </summary>
    public async SysTask SyncForContractAsync(Guid contractId)
    {
        var contract = await _context.Contracts
            .Include(c => c.Products)
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.ContractTasks)
            .FirstOrDefaultAsync(c => c.Id == contractId);

        if (contract is null) return;

        var existingRows = await _context.ManufacturedProducts
            .Where(p => p.ContractId == contractId && p.ContractProductId != null)
            .ToListAsync();

        // Kontrakt o'chirilgan / bekor qilingan — barcha yozuvlarni o'chiramiz.
        if (!contract.IsActive || contract.Status == ContractStatus.Cancelled)
        {
            if (existingRows.Count > 0)
            {
                _context.ManufacturedProducts.RemoveRange(existingRows);
                await _context.SaveChangesAsync();
            }
            return;
        }

        var department = contract.ContractDepartments
            .Where(cd => cd.IsActive && cd.Department != null)
            .Select(cd => cd.Department!)
            .FirstOrDefault(d => d.Type == DepartmentType.IshlabChiqarish)
            ?? contract.ContractDepartments
                .Where(cd => cd.IsActive && cd.Department != null)
                .Select(cd => cd.Department!)
                .FirstOrDefault();

        if (department is null)
        {
            // Bo'limsiz — yozuv yarata olmaymiz. Mavjudlarni ham o'chirib tashlaymiz.
            if (existingRows.Count > 0)
            {
                _context.ManufacturedProducts.RemoveRange(existingRows);
                await _context.SaveChangesAsync();
            }
            return;
        }

        var existingByProductId = existingRows.ToDictionary(r => r.ContractProductId!.Value);
        var keepRowIds = new HashSet<Guid>();
        var newlyCreated = new List<(ManufacturedProduct Row, string DepartmentName)>();

        foreach (var product in contract.Products.Where(p => p.IsActive))
        {
            // Faqat InProduction yoki Completed mahsulotlari ko'rinadi — har bir
            // mahsulot o'z holatida bo'ladi, kontrakt darajasidagi umumiy holat
            // boshqa mahsulotlarni yashirmaydi.
            var include = product.Status == ContractProductStatus.InProduction
                          || product.Status == ContractProductStatus.Completed;
            if (!include) continue;

            var derivedStatus = product.Status == ContractProductStatus.Completed
                ? ManufacturingStatus.Completed
                : ManufacturingStatus.InProgress;

            if (!Enum.TryParse<ProductUnit>(product.Unit, ignoreCase: true, out var unit))
                unit = ProductUnit.Dona;

            var warehouseTask = contract.ContractTasks
                .FirstOrDefault(t => t.IsActive
                                     && t.Name == WarehouseTaskName
                                     && t.ContractProductId == product.Id);

            decimal producedQuantity = warehouseTask?.CompletedAmount ?? 0m;
            if (product.Status == ContractProductStatus.Completed && warehouseTask is null)
                producedQuantity = product.Quantity;

            var firstTask = contract.ContractTasks
                .Where(t => t.IsActive && t.ContractProductId == product.Id)
                .OrderBy(t => t.CreatedAt)
                .FirstOrDefault();

            if (existingByProductId.TryGetValue(product.Id, out var row))
            {
                // Mavjud yozuvni yangilaymiz
                row.Name = product.ProductType;
                row.Code = contract.ContractNo;
                row.Description = product.Notes;
                row.Quantity = product.Quantity;
                row.ProducedQuantity = producedQuantity;
                row.Unit = unit;
                row.Status = derivedStatus;
                row.DepartmentId = department.Id;
                row.ContractId = contract.Id;
                row.StartedAt = firstTask?.CreatedAt ?? row.StartedAt ?? contract.CreatedAt;
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
                    DepartmentId = department.Id,
                    ContractId = contract.Id,
                    ContractProductId = product.Id,
                    StartedAt = firstTask?.CreatedAt ?? contract.CreatedAt,
                    CompletedAt = derivedStatus == ManufacturingStatus.Completed ? DateTime.UtcNow : null,
                    Notes = product.Notes,
                    CreatedBy = contract.CreatedBy,
                    CreatedAt = DateTime.UtcNow,
                };
                _context.ManufacturedProducts.Add(newRow);
                newlyCreated.Add((newRow, department.Name));
            }
        }

        // Tasdiqlanmagan / olib tashlangan mahsulotlarning yozuvlarini o'chiramiz
        var rowsToRemove = existingRows.Where(r => !keepRowIds.Contains(r.Id)).ToList();
        if (rowsToRemove.Count > 0)
            _context.ManufacturedProducts.RemoveRange(rowsToRemove);

        await _context.SaveChangesAsync();

        foreach (var (row, deptName) in newlyCreated)
        {
            await _activityLogService.LogAsync(
                kind: "manufactured",
                title: $"Ishlab chiq.: {row.Name}",
                subtitle: deptName,
                actorId: row.CreatedBy,
                refId: row.Id);
        }
    }

    /// <summary>
    /// Vazifa progress logi yoki update qilinganda chaqiriladi — faqat tegishli mahsulotning
    /// ProducedQuantity-ni jonli ravishda yangilaydi (full sync ishlamasdan).
    /// </summary>
    public async SysTask UpdateProducedQuantityAsync(Guid contractId, Guid? contractProductId)
    {
        if (contractProductId is null) return;

        var row = await _context.ManufacturedProducts
            .FirstOrDefaultAsync(p => p.ContractProductId == contractProductId.Value);
        if (row is null) return;

        var warehouseTask = await _context.ContractTasks
            .Where(t => t.IsActive
                        && t.ContractId == contractId
                        && t.ContractProductId == contractProductId.Value
                        && t.Name == WarehouseTaskName)
            .FirstOrDefaultAsync();

        if (warehouseTask is null) return;

        row.ProducedQuantity = warehouseTask.CompletedAmount;
        await _context.SaveChangesAsync();
    }

    // ─── Mapping ─────────────────────────────────────────────────────────────

    private static ManufacturedProductResponseDto MapToResponse(ManufacturedProduct p) => new()
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
        DepartmentName = p.Department?.Name ?? string.Empty,
        ContractId = p.ContractId,
        ContractProductId = p.ContractProductId,
        ContractNo = p.Contract?.ContractNo,
        StartedAt = p.StartedAt,
        CompletedAt = p.CompletedAt,
        Notes = p.Notes,
        CreatedBy = p.CreatedBy,
        CreatedByFullName = p.Creator is null ? null : $"{p.Creator.FirstName} {p.Creator.LastName}".Trim(),
        CreatedAt = p.CreatedAt,
    };
}
