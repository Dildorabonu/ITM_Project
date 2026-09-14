using Application.DTOs;
using Application.DTOs.Products;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// "Bo'lim omborlari" sahifasini ta'minlovchi servis: bo'limlar bo'yicha umumiy
// statistika (plitkalar) va bitta bo'lim ichidagi mahsulotlar ro'yxati.
// Ikkala metod ham bitta SQL so'rov bilan ishlaydi va faqat UI da ko'rinadigan
// maydonlarni tanlab oladi — entity materializatsiyasi yo'q.
public class DepartmentWarehouseService : IDepartmentWarehouseService
{
    private readonly DatabaseContext _context;

    public DepartmentWarehouseService(DatabaseContext context)
    {
        _context = context;
    }

    // Plitkalar: bo'lim ustuni + zaxira agregatlari bitta so'rovda. Agregatlar
    // Products dagi (DepartmentId, MaterialId) indeksidan foydalanadi.
    public async Task<ApiResult<List<DepartmentWarehouseSummaryDto>>> GetDepartmentSummariesAsync(Guid? restrictToDepartmentId = null)
    {
        var query = _context.Departments.Where(d => d.IsActive);

        if (restrictToDepartmentId.HasValue)
            query = query.Where(d => d.Id == restrictToDepartmentId.Value);

        var result = await query
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentWarehouseSummaryDto
            {
                DepartmentId = d.Id,
                DepartmentName = d.Name,
                DepartmentType = d.Type,
                ProductCount = d.Products.Count(),
                // Bo'sh bo'limda SUM() NULL qaytaradi — 0 ga keltiriladi.
                TotalQuantity = d.Products.Sum(p => (decimal?)p.Quantity) ?? 0m
            })
            .ToListAsync();

        return ApiResult<List<DepartmentWarehouseSummaryDto>>.Success(result);
    }

    // Sarlavha (bo'lim nomi/turi) va jadval qatorlari bitta so'rovda.
    public async Task<ApiResult<DepartmentWarehouseDetailDto>> GetByDepartmentAsync(Guid departmentId)
    {
        var detail = await _context.Departments
            .Where(d => d.Id == departmentId)
            .Select(d => new DepartmentWarehouseDetailDto
            {
                DepartmentName = d.Name,
                DepartmentType = d.Type,
                Products = d.Products
                    .OrderBy(p => p.CreatedAt)
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
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (detail is null)
            return ApiResult<DepartmentWarehouseDetailDto>.Failure([$"Department with id '{departmentId}' not found."], 404);

        return ApiResult<DepartmentWarehouseDetailDto>.Success(detail);
    }
}
