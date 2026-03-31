using Application.DTOs;
using Application.DTOs.Materials;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class MaterialService : IMaterialService
{
    private readonly DatabaseContext _context;

    public MaterialService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<MaterialResponseDto>>> GetAllAsync(string? category = null)
    {
        var query = _context.Materials.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(m => m.Category == category);

        var list = await query.OrderBy(m => m.Name).ToListAsync();

        return ApiResult<IEnumerable<MaterialResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<MaterialResponseDto>> GetByIdAsync(Guid id)
    {
        var material = await _context.Materials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);

        if (material is null)
            return ApiResult<MaterialResponseDto>.Failure([$"Material with id '{id}' not found."], 404);

        return ApiResult<MaterialResponseDto>.Success(MapToResponse(material));
    }

    public async Task<ApiResult<int>> CreateAsync(MaterialCreateDto dto)
    {
        var exists = await _context.Materials.AnyAsync(m => m.Code == dto.Code);
        if (exists)
            return ApiResult<int>.Failure([$"Material with code '{dto.Code}' already exists."], 400);

        var material = new Material
        {
            Id = Guid.NewGuid(),
            Code = dto.Code,
            Name = dto.Name,
            Category = dto.Category,
            Unit = dto.Unit,
            Quantity = dto.Quantity,
            MinQuantity = dto.MinQuantity,
            Location = dto.Location,
            Status = ComputeStatus(dto.Quantity, dto.MinQuantity),
            UpdatedAt = DateTime.UtcNow,
        };

        _context.Materials.Add(material);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> CreateBulkAsync(IEnumerable<MaterialCreateDto> dtos)
    {
        var items = dtos.ToList();
        if (items.Count == 0)
            return ApiResult<int>.Failure(["No materials provided."], 400);
        if (items.Count > 200)
            return ApiResult<int>.Failure(["Maximum 200 materials per request."], 400);

        var materials = items.Select(dto => new Material
        {
            Id = Guid.NewGuid(),
            Code = dto.Code,
            Name = dto.Name,
            Category = dto.Category,
            Unit = dto.Unit,
            Quantity = dto.Quantity,
            MinQuantity = dto.MinQuantity,
            Location = dto.Location,
            Status = ComputeStatus(dto.Quantity, dto.MinQuantity),
            UpdatedAt = DateTime.UtcNow,
        }).ToList();

        _context.Materials.AddRange(materials);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, MaterialUpdateDto dto)
    {
        var material = await _context.Materials.FirstOrDefaultAsync(m => m.Id == id);

        if (material is null)
            return ApiResult<int>.Failure([$"Material with id '{id}' not found."], 404);

        if (dto.Code is not null) material.Code = dto.Code;
        if (dto.Name is not null) material.Name = dto.Name;
        if (dto.Category is not null) material.Category = dto.Category;
        if (dto.Unit is not null) material.Unit = dto.Unit;
        if (dto.Quantity.HasValue) material.Quantity = dto.Quantity.Value;
        if (dto.MinQuantity.HasValue) material.MinQuantity = dto.MinQuantity.Value;
        if (dto.Location is not null) material.Location = dto.Location;

        material.Status = ComputeStatus(material.Quantity, material.MinQuantity);
        material.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var material = await _context.Materials.FirstOrDefaultAsync(m => m.Id == id);

        if (material is null)
            return ApiResult<int>.Failure([$"Material with id '{id}' not found."], 404);

        _context.Materials.Remove(material);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<IEnumerable<MaterialDeficitCheckDto>>> CheckDeficitByCostNormAsync(Guid costNormId)
    {
        var costNorm = await _context.CostNorms
            .Include(c => c.Items)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == costNormId);

        if (costNorm is null)
            return ApiResult<IEnumerable<MaterialDeficitCheckDto>>.Failure([$"CostNorm with id '{costNormId}' not found."], 404);

        var allMaterials = await _context.Materials.AsNoTracking().ToListAsync();

        var results = new List<MaterialDeficitCheckDto>();

        foreach (var item in costNorm.Items.Where(i => !i.IsSection).OrderBy(i => i.SortOrder))
        {
            var itemName = (item.Name ?? "").Trim();
            if (string.IsNullOrEmpty(itemName)) continue;

            var matched = allMaterials.FirstOrDefault(m =>
                string.Equals(m.Name.Trim(), itemName, StringComparison.OrdinalIgnoreCase));

            decimal requiredQty = 0;
            if (decimal.TryParse(item.TotalQty?.Replace(",", "."), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed))
                requiredQty = parsed;

            var availableQty = matched?.Quantity ?? 0;
            var deficitQty = Math.Max(0, requiredQty - availableQty);

            string status;
            if (matched is null)
                status = "Yo'q";
            else if (availableQty >= requiredQty)
                status = "Yetarli";
            else if (availableQty > 0)
                status = "Kam";
            else
                status = "Tugagan";

            results.Add(new MaterialDeficitCheckDto
            {
                CostNormItemName = itemName,
                CostNormItemUnit = item.Unit ?? "",
                RequiredQty = requiredQty,
                AvailableQty = availableQty,
                DeficitQty = deficitQty,
                ExistsInInventory = matched is not null,
                MaterialId = matched?.Id,
                Status = status,
            });
        }

        return ApiResult<IEnumerable<MaterialDeficitCheckDto>>.Success(results);
    }

    private static MaterialStatus ComputeStatus(decimal quantity, decimal minQuantity)
    {
        if (quantity <= 0) return MaterialStatus.OutOfStock;
        if (quantity <= minQuantity) return MaterialStatus.Low;
        return MaterialStatus.Available;
    }

    private static MaterialResponseDto MapToResponse(Material m) => new()
    {
        Id = m.Id,
        Code = m.Code,
        Name = m.Name,
        Category = m.Category,
        Unit = m.Unit,
        Quantity = m.Quantity,
        MinQuantity = m.MinQuantity,
        Location = m.Location,
        Status = m.Status,
        UpdatedAt = m.UpdatedAt,
    };
}
