using Application.DTOs;
using Application.DTOs.Products;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// "Bo'lim omborlari" sahifasini ta'minlovchi servis: bo'limlar bo'yicha umumiy
// statistika (plitkalar) va bitta bo'lim ichidagi mahsulotlar ro'yxati.
public class DepartmentWarehouseService : IDepartmentWarehouseService
{
    private readonly DatabaseContext _context;

    public DepartmentWarehouseService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>> GetDepartmentSummariesAsync(Guid? restrictToDepartmentId = null)
    {
        var deptQuery = _context.Departments.Where(d => d.IsActive).AsNoTracking();

        if (restrictToDepartmentId.HasValue)
            deptQuery = deptQuery.Where(d => d.Id == restrictToDepartmentId.Value);

        var depts = await deptQuery.OrderBy(d => d.Name).ToListAsync();
        if (depts.Count == 0)
            return ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>.Success([]);

        var deptIds = depts.Select(d => d.Id).ToList();
        var stats = await _context.Products
            .Where(p => deptIds.Contains(p.DepartmentId))
            .GroupBy(p => p.DepartmentId)
            .Select(g => new
            {
                DepartmentId = g.Key,
                ProductCount = g.Count(),
                TotalQuantity = g.Sum(p => p.Quantity)
            })
            .ToListAsync();

        var statMap = stats.ToDictionary(s => s.DepartmentId);

        var result = depts.Select(d =>
        {
            statMap.TryGetValue(d.Id, out var s);
            return new DepartmentWarehouseSummaryDto
            {
                DepartmentId = d.Id,
                DepartmentName = d.Name,
                DepartmentType = d.Type,
                ProductCount = s?.ProductCount ?? 0,
                TotalQuantity = s?.TotalQuantity ?? 0m
            };
        });

        return ApiResult<IEnumerable<DepartmentWarehouseSummaryDto>>.Success(result);
    }

    public async Task<ApiResult<IEnumerable<DepartmentProductDto>>> GetByDepartmentAsync(Guid departmentId)
    {
        var products = await _context.Products
            .Where(p => p.DepartmentId == departmentId)
            .AsNoTracking()
            .Select(p => new DepartmentProductDto
            {
                Id = p.Id,
                Name = p.Name,
                InvoiceNumber = p.InvoiceNumber,
                Description = p.Description,
                Quantity = p.Quantity,
                Unit = p.Unit,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return ApiResult<IEnumerable<DepartmentProductDto>>.Success(products);
    }
}
