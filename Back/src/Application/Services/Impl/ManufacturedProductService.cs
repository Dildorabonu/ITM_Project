using Application.DTOs;
using Application.DTOs.ManufacturedProducts;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

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

    public async Task<ApiResult<PagedResult<ManufacturedProductResponseDto>>> GetAllAsync(
        int page, int pageSize, string? search, Guid? departmentId, ManufacturingStatus? status)
    {
        var allItems = await BuildItemsAsync();

        if (status.HasValue)
            allItems = allItems.Where(i => i.Status == status.Value).ToList();

        if (departmentId.HasValue)
            allItems = allItems.Where(i => i.DepartmentId == departmentId.Value).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            allItems = allItems.Where(i =>
                i.Name.ToLower().Contains(lower) ||
                (i.Code != null && i.Code.ToLower().Contains(lower)) ||
                (i.ContractNo != null && i.ContractNo.ToLower().Contains(lower)) ||
                i.DepartmentName.ToLower().Contains(lower)
            ).ToList();
        }

        var ordered = allItems.OrderByDescending(i => i.CreatedAt).ToList();
        var totalCount = ordered.Count;

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = ordered
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize);

        var paged = PagedResult<ManufacturedProductResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ManufacturedProductResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<ManufacturedProductStatsDto>> GetStatsAsync()
    {
        var allItems = await BuildItemsAsync();

        var stats = new ManufacturedProductStatsDto
        {
            Total = allItems.Count,
            InProgress = allItems.Count(i => i.Status == ManufacturingStatus.InProgress),
            Completed = allItems.Count(i => i.Status == ManufacturingStatus.Completed),
        };

        return ApiResult<ManufacturedProductStatsDto>.Success(stats);
    }

    public async Task<ApiResult<ManufacturedProductResponseDto>> GetByIdAsync(Guid id)
    {
        var product = await _context.ContractProducts
            .AsNoTracking()
            .Include(p => p.Contract)!
                .ThenInclude(c => c!.ContractDepartments)
                    .ThenInclude(cd => cd.Department)
            .Include(p => p.Contract)!
                .ThenInclude(c => c!.ContractTasks)
            .Include(p => p.Contract)!
                .ThenInclude(c => c!.Creator)
            .FirstOrDefaultAsync(p => p.Id == id && p.IsActive);

        if (product?.Contract is null || !product.Contract.IsActive)
            return ApiResult<ManufacturedProductResponseDto>.Failure([$"Manufactured product with id '{id}' not found."]);

        if (product.Contract.Status != ContractStatus.InProduction && product.Contract.Status != ContractStatus.Completed)
            return ApiResult<ManufacturedProductResponseDto>.Failure([$"Manufactured product with id '{id}' not found."]);

        return ApiResult<ManufacturedProductResponseDto>.Success(MapContractProductToDto(product.Contract, product));
    }

    public System.Threading.Tasks.Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Mahsulotlar shartnoma vazifalaridan avtomatik tushadi — qo'lda qo'shib bo'lmaydi."]));

    public System.Threading.Tasks.Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Tayyor mahsulot avtomatik tarzda shartnoma jarayonidan boshqariladi — tahrirlab bo'lmaydi."]));

    public System.Threading.Tasks.Task<ApiResult<int>> DeleteAsync(Guid id)
        => System.Threading.Tasks.Task.FromResult(ApiResult<int>.Failure(
            ["Tayyor mahsulotni qo'lda o'chirib bo'lmaydi — shartnoma holati o'zgartirilsa, ro'yxatdan avtomatik chiqadi."]));

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async Task<List<ManufacturedProductResponseDto>> BuildItemsAsync()
    {
        // Faqat ishlab chiqarish jarayoni boshlangan yoki yakunlangan kontraktlar.
        // Bekor qilingan / chizma bosqichidagi kontraktlar ro'yxatda ko'rinmaydi.
        var contracts = await _context.Contracts
            .AsNoTracking()
            .Where(c => c.IsActive &&
                        (c.Status == ContractStatus.InProduction || c.Status == ContractStatus.Completed))
            .Include(c => c.Products)
            .Include(c => c.ContractDepartments)
                .ThenInclude(cd => cd.Department)
            .Include(c => c.ContractTasks)
            .Include(c => c.Creator)
            .ToListAsync();

        var items = new List<ManufacturedProductResponseDto>();
        foreach (var contract in contracts)
        {
            foreach (var product in contract.Products.Where(p => p.IsActive).OrderBy(p => p.OrderIndex))
            {
                items.Add(MapContractProductToDto(contract, product));
            }
        }
        return items;
    }

    private ManufacturedProductResponseDto MapContractProductToDto(Contract contract, ContractProduct product)
    {
        // Avval ishlab chiqarish bo'limini, yo'q bo'lsa kontraktning birinchi faol bo'limini olamiz.
        var department = contract.ContractDepartments
            .Where(cd => cd.IsActive && cd.Department != null)
            .Select(cd => cd.Department!)
            .FirstOrDefault(d => d.Type == DepartmentType.IshlabChiqarish)
            ?? contract.ContractDepartments
                .Where(cd => cd.IsActive && cd.Department != null)
                .Select(cd => cd.Department!)
                .FirstOrDefault();

        var derivedStatus = contract.Status == ContractStatus.Completed
            ? ManufacturingStatus.Completed
            : ManufacturingStatus.InProgress;

        // Ombor vazifasi (avtomatik yaratilgan) — uning completedAmount-i mahsulot uchun
        // haqiqiy ishlab chiqarilgan miqdor sifatida ishlatiladi.
        var warehouseTask = contract.ContractTasks
            .FirstOrDefault(t => t.IsActive
                                 && t.Name == WarehouseTaskName
                                 && t.ContractProductId == product.Id);

        decimal producedQuantity = warehouseTask?.CompletedAmount ?? 0m;

        // Kontrakt yakunlangan, lekin ombor vazifasi yo'q bo'lsa — to'liq ishlab chiqarilgan deb belgilaymiz.
        if (contract.Status == ContractStatus.Completed && warehouseTask is null)
            producedQuantity = product.Quantity;

        if (!Enum.TryParse<ProductUnit>(product.Unit, ignoreCase: true, out var unit))
            unit = ProductUnit.Dona;

        // Ishlab chiqarish boshlanish sanasi sifatida ushbu mahsulotga tegishli birinchi vazifa sanasini olamiz.
        var firstTask = contract.ContractTasks
            .Where(t => t.IsActive && t.ContractProductId == product.Id)
            .OrderBy(t => t.CreatedAt)
            .FirstOrDefault();

        return new ManufacturedProductResponseDto
        {
            Id = product.Id,
            Name = product.ProductType,
            Code = contract.ContractNo,
            Description = product.Notes,
            Quantity = product.Quantity,
            ProducedQuantity = producedQuantity,
            Unit = unit,
            Status = derivedStatus,
            DepartmentId = department?.Id ?? Guid.Empty,
            DepartmentName = department?.Name ?? string.Empty,
            ContractId = contract.Id,
            ContractNo = contract.ContractNo,
            StartedAt = firstTask?.CreatedAt ?? contract.CreatedAt,
            CompletedAt = derivedStatus == ManufacturingStatus.Completed ? (DateTime?)contract.CreatedAt : null,
            Notes = product.Notes,
            CreatedBy = contract.CreatedBy,
            CreatedByFullName = contract.Creator is null
                ? null
                : $"{contract.Creator.FirstName} {contract.Creator.LastName}".Trim(),
            CreatedAt = contract.CreatedAt,
        };
    }
}
