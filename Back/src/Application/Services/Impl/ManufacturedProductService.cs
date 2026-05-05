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

    // Tasks page-da har bir mahsulot uchun avtomatik yaratiladigan ombor vazifasining nomi.
    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    public ManufacturedProductService(DatabaseContext context)
    {
        _context = context;
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
            // Auto-derived ro'yxat — har bir yozuv ContractProduct bilan bog'langan bo'lishi shart.
            .Where(p => p.ContractProductId != null);

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
            .Where(p => p.ContractProductId != null)
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

    // ─── Write operations — disabled (auto-managed) ──────────────────────────

    public System.Threading.Tasks.Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Mahsulotlar shartnoma vazifalaridan avtomatik tushadi — qo'lda qo'shib bo'lmaydi."]));

    public System.Threading.Tasks.Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Tayyor mahsulot avtomatik tarzda shartnoma jarayonidan boshqariladi — tahrirlab bo'lmaydi."]));

    public System.Threading.Tasks.Task<ApiResult<int>> DeleteAsync(Guid id)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Tayyor mahsulotni qo'lda o'chirib bo'lmaydi — shartnoma holati o'zgartirilsa, ro'yxatdan avtomatik chiqadi."]));

    // ─── Sync ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Shartnoma ostidagi har bir mahsulot uchun ManufacturedProducts jadvalini yangilaydi:
    /// — Tex jarayoni va xarajat normasi tasdiqlangan, kontrakt holati InProduction/Completed bo'lsa,
    ///   yozuv qo'shiladi yoki yangilanadi.
    /// — Aks holda (yoki kontrakt Cancelled/IsActive=false bo'lsa), yozuv o'chiriladi.
    /// Bu metod shartnoma holati, tex jarayon yoki xarajat normasi o'zgargan har safar chaqiriladi.
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

        // Kontrakt o'chirilgan / bekor qilingan / faqat boshlang'ich bosqichda — barcha yozuvlarni o'chiramiz.
        if (!contract.IsActive
            || contract.Status == ContractStatus.Cancelled
            || contract.Status == ContractStatus.DrawingPending
            || contract.Status == ContractStatus.TechProcessing)
        {
            if (existingRows.Count > 0)
            {
                _context.ManufacturedProducts.RemoveRange(existingRows);
                await _context.SaveChangesAsync();
            }
            return;
        }

        // Per-product approval set
        var approvedTpProductIds = await _context.TechProcesses
            .Where(tp => tp.IsActive
                         && tp.ContractProductId != null
                         && tp.ContractId == contractId
                         && (tp.Status == ProcessStatus.Approved || tp.Status == ProcessStatus.Completed))
            .Select(tp => tp.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var approvedCnProductIds = await _context.CostNorms
            .Where(cn => cn.IsActive
                         && cn.ContractProductId != null
                         && cn.ContractId == contractId
                         && cn.Status == DrawingStatus.Approved
                         && cn.Items.Any(i => i.IsActive))
            .Select(cn => cn.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var readyProductIds = approvedTpProductIds.Intersect(approvedCnProductIds).ToHashSet();

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

        var derivedStatus = contract.Status == ContractStatus.Completed
            ? ManufacturingStatus.Completed
            : ManufacturingStatus.InProgress;

        var existingByProductId = existingRows.ToDictionary(r => r.ContractProductId!.Value);
        var keepRowIds = new HashSet<Guid>();

        foreach (var product in contract.Products.Where(p => p.IsActive))
        {
            // Yakunlangan kontraktlarda hamma mahsulot saqlanadi (allaqachon ishlab chiqarilgan);
            // aks holda — faqat tasdiqlangan mahsulotlar.
            var include = contract.Status == ContractStatus.Completed || readyProductIds.Contains(product.Id);
            if (!include) continue;

            if (!Enum.TryParse<ProductUnit>(product.Unit, ignoreCase: true, out var unit))
                unit = ProductUnit.Dona;

            var warehouseTask = contract.ContractTasks
                .FirstOrDefault(t => t.IsActive
                                     && t.Name == WarehouseTaskName
                                     && t.ContractProductId == product.Id);

            decimal producedQuantity = warehouseTask?.CompletedAmount ?? 0m;
            if (contract.Status == ContractStatus.Completed && warehouseTask is null)
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
            }
        }

        // Tasdiqlanmagan / olib tashlangan mahsulotlarning yozuvlarini o'chiramiz
        var rowsToRemove = existingRows.Where(r => !keepRowIds.Contains(r.Id)).ToList();
        if (rowsToRemove.Count > 0)
            _context.ManufacturedProducts.RemoveRange(rowsToRemove);

        await _context.SaveChangesAsync();
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
        ContractNo = p.Contract?.ContractNo,
        StartedAt = p.StartedAt,
        CompletedAt = p.CompletedAt,
        Notes = p.Notes,
        CreatedBy = p.CreatedBy,
        CreatedByFullName = p.Creator is null ? null : $"{p.Creator.FirstName} {p.Creator.LastName}".Trim(),
        CreatedAt = p.CreatedAt,
    };
}
