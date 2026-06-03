using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// "Muzlatilgan mahsulotlar" — talabnomalar bo'yicha rezerv qilingan (lekin hali
// berilmagan) mahsulotlar ro'yxati. Korxona omborxonasi sahifasidagi alohida ko'rinish.
public partial class ProductService
{
    public async Task<ApiResult<PagedResult<ProductReservationDto>>> GetReservationsAsync(int page, int pageSize, string? search, Guid? restrictToDepartmentId = null)
    {
        // Rezerv hali "tirik" deb hisoblanadigan statuslar — Released yoki Rejected emas.
        var activeStatuses = new[]
        {
            RequisitionStatus.PendingApproval,
            RequisitionStatus.ReadyForWarehouseRelease
        };

        var query = _context.RequisitionItems
            .Include(i => i.ReservedProduct)
            .Include(i => i.Requisition).ThenInclude(r => r!.Department)
            .Where(i => i.ReservedProductId != null
                && i.Requisition != null
                && activeStatuses.Contains(i.Requisition.Status))
            .AsNoTracking();

        if (restrictToDepartmentId.HasValue)
            query = query.Where(i => i.ReservedProduct!.DepartmentId == restrictToDepartmentId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLower();
            query = query.Where(i =>
                i.ReservedProduct!.Name.ToLower().Contains(lower) ||
                i.ReservedProduct.InvoiceNumber.ToLower().Contains(lower) ||
                i.Requisition!.RequisitionNo.ToLower().Contains(lower) ||
                i.Requisition.Purpose.ToLower().Contains(lower) ||
                (i.Requisition.Department != null && i.Requisition.Department.Name.ToLower().Contains(lower)));
        }

        var totalCount = await query.CountAsync();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var items = await query
            .OrderByDescending(i => i.Requisition!.WarehouseCheckedAt ?? i.Requisition.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var dtos = items.Select(i => new ProductReservationDto
        {
            ProductId = i.ReservedProduct!.Id,
            ProductName = i.ReservedProduct.Name,
            InvoiceNumber = i.ReservedProduct.InvoiceNumber,
            Unit = i.ReservedProduct.Unit,
            ReservedQuantity = i.Quantity,
            RequisitionId = i.Requisition!.Id,
            RequisitionNo = i.Requisition.RequisitionNo,
            Purpose = i.Requisition.Purpose,
            TargetDepartmentName = i.Requisition.Department?.Name,
            Status = i.Requisition.Status,
            StatusLabel = ReservationStatusLabel(i.Requisition.Status),
            WarehouseCheckedAt = i.Requisition.WarehouseCheckedAt
        });

        var paged = PagedResult<ProductReservationDto>.Create(dtos, totalCount, pagination);
        return ApiResult<PagedResult<ProductReservationDto>>.Success(paged);
    }

    private static string ReservationStatusLabel(RequisitionStatus s) => s switch
    {
        RequisitionStatus.PendingApproval          => "Tasdiqlash kutilmoqda",
        RequisitionStatus.ReadyForWarehouseRelease => "Chiqarish kutilmoqda",
        _                                          => s.ToString()
    };
}
