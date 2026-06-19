using Application.DTOs;
using Application.DTOs.StockMovements;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class StockMovementService : IStockMovementService
{
    private readonly DatabaseContext _context;

    public StockMovementService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<PagedResult<StockMovementResponseDto>>> GetAsync(StockMovementFilter filter)
    {
        var query = _context.StockMovements
            .Include(m => m.Product)
            .Include(m => m.Material)
            .Include(m => m.SourceDepartment)
            .Include(m => m.TargetDepartment)
            .Include(m => m.Requisition)
            .Include(m => m.User)
            .AsNoTracking()
            .AsQueryable();

        if (filter.ProductId.HasValue)
            query = query.Where(m => m.ProductId == filter.ProductId.Value);

        if (filter.MaterialId.HasValue)
            query = query.Where(m => m.MaterialId == filter.MaterialId.Value);

        if (filter.DepartmentId.HasValue)
            query = query.Where(m =>
                m.SourceDepartmentId == filter.DepartmentId.Value ||
                m.TargetDepartmentId == filter.DepartmentId.Value);

        if (filter.RequisitionId.HasValue)
            query = query.Where(m => m.RequisitionId == filter.RequisitionId.Value);

        if (filter.ContractId.HasValue)
            query = query.Where(m => m.ContractId == filter.ContractId.Value);

        if (filter.UserId.HasValue)
            query = query.Where(m => m.UserId == filter.UserId.Value);

        if (filter.Type.HasValue)
            query = query.Where(m => m.Type == filter.Type.Value);

        if (filter.From.HasValue)
            query = query.Where(m => m.CreatedAt >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(m => m.CreatedAt <= filter.To.Value);

        var pagination = new PaginationParams { Page = filter.Page, PageSize = filter.PageSize };

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var paged = PagedResult<StockMovementResponseDto>.Create(items.Select(MapToResponse), totalCount, pagination);
        return ApiResult<PagedResult<StockMovementResponseDto>>.Success(paged);
    }

    private static string TypeLabel(StockMovementType t) => t switch
    {
        StockMovementType.In       => "Kirim",
        StockMovementType.Out      => "Chiqim",
        StockMovementType.Transfer => "Ko'chirish",
        StockMovementType.Adjust   => "Tuzatish",
        StockMovementType.Reserve  => "Rezerv",
        StockMovementType.Release  => "Rezervdan chiqarish",
        _                          => t.ToString()
    };

    private static StockMovementResponseDto MapToResponse(StockMovement m) => new()
    {
        Id = m.Id,
        Type = m.Type,
        TypeLabel = TypeLabel(m.Type),
        ProductId = m.ProductId,
        ProductName = m.Product?.Name ?? string.Empty,
        MaterialId = m.MaterialId,
        MaterialName = m.Material?.Name,
        SourceDepartmentId = m.SourceDepartmentId,
        SourceDepartmentName = m.SourceDepartment?.Name,
        TargetDepartmentId = m.TargetDepartmentId,
        TargetDepartmentName = m.TargetDepartment?.Name,
        Quantity = m.Quantity,
        QuantityAfter = m.QuantityAfter,
        RequisitionId = m.RequisitionId,
        RequisitionNo = m.Requisition?.RequisitionNo,
        ContractId = m.ContractId,
        UserId = m.UserId,
        UserFullName = m.User is null ? string.Empty : $"{m.User.FirstName} {m.User.LastName}",
        CreatedAt = m.CreatedAt,
        Notes = m.Notes
    };
}
