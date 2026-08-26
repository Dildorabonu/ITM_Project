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
        var query = ApplyFilters(_context.StockMovements.AsNoTracking(), filter, includeType: true);

        var pagination = new PaginationParams { Page = filter.Page, PageSize = filter.PageSize };

        var totalCount = await query.CountAsync();

        // Include emas, Select: bog'langan jadvallardan faqat bitta nom ustuni kerak.
        // Include bilan Product/Material/Department/Requisition/User qatorlari to'liq
        // (barcha ustunlari bilan) tortilar edi va EF ularni tracking'siz ham
        // materializatsiya qilardi.
        var items = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(m => new StockMovementResponseDto
            {
                Id = m.Id,
                Type = m.Type,
                ProductName = m.Product!.Name,
                MaterialName = m.Material!.Name,
                SourceDepartmentName = m.SourceDepartment!.Name,
                TargetDepartmentName = m.TargetDepartment!.Name,
                Quantity = m.Quantity,
                QuantityAfter = m.QuantityAfter,
                RequisitionNo = m.Requisition!.RequisitionNo,
                UserFullName = m.User!.FirstName + " " + m.User.LastName,
                CreatedAt = m.CreatedAt,
                Notes = m.Notes
            })
            .ToListAsync();

        var paged = PagedResult<StockMovementResponseDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<StockMovementResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<StockMovementSummaryDto>> GetSummaryAsync(StockMovementFilter filter)
    {
        // includeType: false — tanlangan tur qolgan tugmachalarning sonini o'chirmasin.
        var query = ApplyFilters(_context.StockMovements.AsNoTracking(), filter, includeType: false);

        var counts = await query
            .GroupBy(m => m.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync();

        // Oltala tur har doim kalit sifatida bo'lishi shart — mos qator bo'lmasa 0.
        var byType = Enum.GetValues<StockMovementType>()
            .ToDictionary(
                t => t.ToString(),
                t => counts.FirstOrDefault(c => c.Type == t)?.Count ?? 0);

        return ApiResult<StockMovementSummaryDto>.Success(new StockMovementSummaryDto
        {
            Total = byType.Values.Sum(),
            ByType = byType
        });
    }

    // GetAsync va GetSummaryAsync bir xil filtrlarni qo'llaydi — mantiq shu yerda.
    private static IQueryable<StockMovement> ApplyFilters(
        IQueryable<StockMovement> query, StockMovementFilter filter, bool includeType)
    {
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

        if (includeType && filter.Type.HasValue)
            query = query.Where(m => m.Type == filter.Type.Value);

        if (filter.From.HasValue)
            query = query.Where(m => m.CreatedAt >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(m => m.CreatedAt <= filter.To.Value);

        return query;
    }
}
