using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Core.Enums;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// "Muzlatilgan mahsulotlar" — talabnomalar bo'yicha rezerv qilingan (lekin hali
// berilmagan) mahsulotlar ro'yxati. Korxona omborxonasi sahifasidagi alohida ko'rinish.
public partial class ProductService
{
    public async Task<ApiResult<PagedResult<ProductReservationDto>>> GetReservationsAsync(int page, int pageSize, string? search, Guid? restrictToDepartmentId = null)
    {
        // Rezerv hali "tirik" deb hisoblanadigan statuslar — Released yoki Rejected emas.
        var query = _context.RequisitionItems
            .AsNoTracking()
            .Where(i => i.ReservedProductId != null
                && i.Requisition != null
                && (i.Requisition.Status == RequisitionStatus.PendingApproval
                    || i.Requisition.Status == RequisitionStatus.ReadyForWarehouseRelease));

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

        // To'g'ridan-to'g'ri DTO ga proyeksiya. Include bilan to'liq entity yuklansa
        // Requisition ning base64 imzo rasmlari (QrCodeData, WarehouseCheckQrCodeData) va
        // RequisitionItem ning FreeTextPhoto maydoni ham bekorga o'qilardi.
        var items = await query
            .OrderByDescending(i => i.Requisition!.WarehouseCheckedAt ?? i.Requisition.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(i => new ProductReservationDto
            {
                ProductId = i.ReservedProduct!.Id,
                ProductName = i.ReservedProduct.Name,
                InvoiceNumber = i.ReservedProduct.InvoiceNumber,
                Unit = i.ReservedProduct.Unit,
                ReservedQuantity = i.Quantity,
                RequisitionId = i.Requisition!.Id,
                RequisitionNo = i.Requisition.RequisitionNo,
                Purpose = i.Requisition.Purpose,
                TargetDepartmentName = i.Requisition.Department != null ? i.Requisition.Department.Name : null,
                Status = i.Requisition.Status,
                WarehouseCheckedAt = i.Requisition.WarehouseCheckedAt
            })
            .ToListAsync();

        var paged = PagedResult<ProductReservationDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ProductReservationDto>>.Success(paged);
    }
}
