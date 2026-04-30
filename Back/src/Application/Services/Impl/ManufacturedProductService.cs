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

    public ManufacturedProductService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<PagedResult<ManufacturedProductResponseDto>>> GetAllAsync(
        int page, int pageSize, string? search, Guid? departmentId, ManufacturingStatus? status)
    {
        var query = _context.ManufacturedProducts
            .Include(p => p.Department)
            .Include(p => p.Contract)
            .Include(p => p.Creator)
            .AsNoTracking();

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

    public async Task<ApiResult<int>> CreateAsync(ManufacturedProductCreateDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<int>.Failure(["Mahsulot nomi kiritilishi shart."]);

        if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Bo'lim topilmadi: '{dto.DepartmentId}'."]);

        if (dto.ContractId.HasValue && !await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId.Value))
            return ApiResult<int>.Failure([$"Shartnoma topilmadi: '{dto.ContractId}'."]);

        if (dto.Quantity < 0 || dto.ProducedQuantity < 0)
            return ApiResult<int>.Failure(["Miqdor manfiy bo'lishi mumkin emas."]);

        if (dto.ProducedQuantity > dto.Quantity)
            return ApiResult<int>.Failure(["Ishlab chiqarilgan soni umumiy miqdordan ko'p bo'lishi mumkin emas."]);

        var status = dto.Status;
        if (dto.Quantity > 0 && dto.ProducedQuantity >= dto.Quantity)
            status = ManufacturingStatus.Completed;

        var product = new ManufacturedProduct
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            Code = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim(),
            Description = dto.Description,
            Quantity = dto.Quantity,
            ProducedQuantity = dto.ProducedQuantity,
            Unit = dto.Unit,
            Status = status,
            DepartmentId = dto.DepartmentId,
            ContractId = dto.ContractId,
            StartedAt = dto.StartedAt ?? (status == ManufacturingStatus.InProgress ? DateTime.UtcNow : null),
            CompletedAt = dto.CompletedAt ?? (status == ManufacturingStatus.Completed ? DateTime.UtcNow : null),
            Notes = dto.Notes,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _context.ManufacturedProducts.Add(product);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ManufacturedProductUpdateDto dto)
    {
        var product = await _context.ManufacturedProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return ApiResult<int>.Failure([$"Manufactured product with id '{id}' not found."]);

        if (dto.DepartmentId.HasValue && dto.DepartmentId.Value != product.DepartmentId)
        {
            if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value))
                return ApiResult<int>.Failure([$"Bo'lim topilmadi: '{dto.DepartmentId}'."]);
            product.DepartmentId = dto.DepartmentId.Value;
        }

        if (dto.ContractId.HasValue)
        {
            if (!await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId.Value))
                return ApiResult<int>.Failure([$"Shartnoma topilmadi: '{dto.ContractId}'."]);
            product.ContractId = dto.ContractId;
        }

        if (dto.Name is not null) product.Name = dto.Name.Trim();
        if (dto.Code is not null) product.Code = string.IsNullOrWhiteSpace(dto.Code) ? null : dto.Code.Trim();
        if (dto.Description is not null) product.Description = dto.Description;
        if (dto.Quantity.HasValue) product.Quantity = dto.Quantity.Value;
        if (dto.ProducedQuantity.HasValue) product.ProducedQuantity = dto.ProducedQuantity.Value;
        if (dto.Unit.HasValue) product.Unit = dto.Unit.Value;
        if (dto.Notes is not null) product.Notes = dto.Notes;
        if (dto.StartedAt.HasValue) product.StartedAt = dto.StartedAt;

        if (product.Quantity < 0 || product.ProducedQuantity < 0)
            return ApiResult<int>.Failure(["Miqdor manfiy bo'lishi mumkin emas."]);

        if (product.ProducedQuantity > product.Quantity)
            return ApiResult<int>.Failure(["Ishlab chiqarilgan soni umumiy miqdordan ko'p bo'lishi mumkin emas."]);

        // Auto-flip status when ProducedQuantity reaches Quantity (or explicit override)
        if (dto.Status.HasValue)
        {
            product.Status = dto.Status.Value;
        }
        else if (product.Quantity > 0 && product.ProducedQuantity >= product.Quantity)
        {
            product.Status = ManufacturingStatus.Completed;
        }

        if (product.Status == ManufacturingStatus.Completed && product.CompletedAt is null)
            product.CompletedAt = dto.CompletedAt ?? DateTime.UtcNow;

        if (product.Status == ManufacturingStatus.InProgress)
            product.CompletedAt = null;

        if (dto.CompletedAt.HasValue) product.CompletedAt = dto.CompletedAt;

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var product = await _context.ManufacturedProducts.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return ApiResult<int>.Failure([$"Manufactured product with id '{id}' not found."]);

        _context.ManufacturedProducts.Remove(product);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

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
