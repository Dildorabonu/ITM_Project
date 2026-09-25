using Application.DTOs;
using Application.DTOs.Scan;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// Ombor skaneri (HID keyboard-wedge) uchun lookup + amal logikasi.
// StockMovement yozish patterni RequisitionService.AddMovement bilan bir xil
// (u private bo'lgani uchun shu yerda takrorlanadi): miqdor o'zgartirilgandan KEYIN
// QuantityAfter snapshot bilan ledgerga qator qo'shiladi.
public class ScanService : IScanService
{
    private readonly DatabaseContext _context;
    private readonly IQrCodeService _qrCodeService;

    public ScanService(DatabaseContext context, IQrCodeService qrCodeService)
    {
        _context = context;
        _qrCodeService = qrCodeService;
    }

    public async Task<ApiResult<ScanLookupDto>> LookupAsync(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return ApiResult<ScanLookupDto>.Failure(["Kod kiritilmadi."]);

        code = code.Trim();

        var product = await _context.Products
            .Include(p => p.Department)
            .Include(p => p.Material)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.QrCode == code);

        if (product is null)
            return ApiResult<ScanLookupDto>.Failure([$"'{code}' kodli mahsulot topilmadi."], 404);

        return ApiResult<ScanLookupDto>.Success(await BuildLookupAsync(product));
    }

    public async Task<ApiResult<ScanLabelDto>> GetLabelAsync(Guid id)
    {
        var product = await _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<ScanLabelDto>.Failure([$"Mahsulot '{id}' topilmadi."], 404);

        return ApiResult<ScanLabelDto>.Success(new ScanLabelDto
        {
            QrPngBase64 = product.QrCode is null ? string.Empty : _qrCodeService.RenderPngBase64(product.QrCode),
            Name = product.Name,
            Code = product.QrCode,
            Quantity = product.Quantity,
            Unit = product.Unit,
            DepartmentName = product.Department?.Name ?? string.Empty
        });
    }

    public async Task<ApiResult<ScanLookupDto>> ActionAsync(ScanActionDto dto, Guid userId)
    {
        // Adjust uchun 0 yangi-absolut qiymat ruxsat etiladi; qolganlari musbat bo'lishi shart.
        if (dto.Type != StockMovementType.Adjust && dto.Quantity <= 0)
            return ApiResult<ScanLookupDto>.Failure(["Miqdor noldan katta bo'lishi kerak."]);

        var product = await _context.Products
            .Include(p => p.Department)
            .Include(p => p.Material)
            .FirstOrDefaultAsync(p => p.Id == dto.ProductId);

        if (product is null)
            return ApiResult<ScanLookupDto>.Failure([$"Mahsulot '{dto.ProductId}' topilmadi."], 404);

        switch (dto.Type)
        {
            case StockMovementType.Out:
            {
                if (dto.TargetDepartmentId is not Guid targetDeptId)
                    return ApiResult<ScanLookupDto>.Failure(["Chiqim uchun maqsad bo'lim ko'rsatilishi shart."]);

                if (targetDeptId == product.DepartmentId)
                    return ApiResult<ScanLookupDto>.Failure(["Maqsad bo'lim manba bo'lim bilan bir xil bo'lmasligi kerak."]);

                if (!await _context.Departments.AnyAsync(d => d.Id == targetDeptId))
                    return ApiResult<ScanLookupDto>.Failure(["Maqsad bo'lim topilmadi."], 404);

                var available = product.Quantity - product.ReservedQuantity;
                if (dto.Quantity > available)
                    return ApiResult<ScanLookupDto>.Failure(
                        [$"Yetarli mavjud emas (mavjud: {available}, so'ralgan: {dto.Quantity})."]);

                // Manba qatordan kamaytirish.
                product.Quantity -= dto.Quantity;

                // Maqsad bo'limda Product qatorini topish/yaratish — RequisitionService
                // upsert mantig'i bilan bir xil: katalog itemlar MaterialId bo'yicha,
                // FreeText itemlar normalize(nom) + birlik bo'yicha.
                Product? target = product.MaterialId.HasValue
                    ? await _context.Products.FirstOrDefaultAsync(p =>
                        p.DepartmentId == targetDeptId && p.MaterialId == product.MaterialId.Value)
                    : await _context.Products.FirstOrDefaultAsync(p =>
                        p.DepartmentId == targetDeptId
                        && p.NameNormalized == product.NameNormalized
                        && p.Unit == product.Unit);

                if (target is not null)
                {
                    target.Quantity += dto.Quantity;
                }
                else
                {
                    target = new Product
                    {
                        Id = Guid.NewGuid(),
                        Name = product.Name,
                        NameNormalized = product.NameNormalized,
                        InvoiceNumber = product.InvoiceNumber,
                        QrCode = await ProductCodeGenerator.NewUniqueAsync(_context),
                        Description = product.Description,
                        Quantity = dto.Quantity,
                        Unit = product.Unit,
                        DepartmentId = targetDeptId,
                        MaterialId = product.MaterialId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Products.Add(target);
                }

                // Ledger: chiqim harakati maqsad qatorga yoziladi (QuantityAfter = target.Quantity),
                // RequisitionService ReleaseAsync bilan bir xil.
                AddMovement(StockMovementType.Out, target, dto.Quantity, product.MaterialId,
                    product.DepartmentId, targetDeptId, userId, dto.Notes);
                break;
            }

            case StockMovementType.Adjust:
            {
                if (dto.Quantity < 0)
                    return ApiResult<ScanLookupDto>.Failure(["Yangi miqdor manfiy bo'lishi mumkin emas."]);

                // Quantity = yangi absolut qiymat; movement.Quantity = abs(delta).
                var delta = Math.Abs(dto.Quantity - product.Quantity);
                product.Quantity = dto.Quantity;
                AddMovement(StockMovementType.Adjust, product, delta, product.MaterialId,
                    product.DepartmentId, null, userId, dto.Notes);
                break;
            }

            default:
                return ApiResult<ScanLookupDto>.Failure(["Bu amal turi qo'llab-quvvatlanmaydi."]);
        }

        await _context.SaveChangesAsync();

        return ApiResult<ScanLookupDto>.Success(await BuildLookupAsync(product));
    }

    // ─── Yordamchilar ─────────────────────────────────────────────────────────

    // RequisitionService.AddMovement bilan bir xil: miqdor o'zgartirilgandan KEYIN,
    // QuantityAfter = product.Quantity snapshot bilan ledgerga qator qo'shadi.
    private void AddMovement(StockMovementType type, Product product, decimal qty,
        Guid? materialId, Guid? sourceDeptId, Guid? targetDeptId, Guid userId, string? notes)
    {
        _context.StockMovements.Add(new StockMovement
        {
            Id = Guid.NewGuid(),
            Type = type,
            ProductId = product.Id,
            MaterialId = materialId,
            SourceDepartmentId = sourceDeptId,
            TargetDepartmentId = targetDeptId,
            Quantity = qty,
            QuantityAfter = product.Quantity,
            RequisitionId = null,
            ContractId = null,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            Notes = notes
        });
    }

    private async Task<ScanLookupDto> BuildLookupAsync(Product product)
    {
        MaterialAggregateDto? aggregate = null;
        if (product.MaterialId is Guid matId)
        {
            var rows = await _context.Products
                .Where(p => p.MaterialId == matId)
                .Include(p => p.Department)
                .AsNoTracking()
                .ToListAsync();

            var material = product.Material
                ?? await _context.Materials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matId);

            aggregate = new MaterialAggregateDto
            {
                Code = material?.Code ?? string.Empty,
                Name = material?.Name ?? string.Empty,
                TotalQuantity = rows.Sum(p => p.Quantity),
                CatalogQuantity = material?.Quantity ?? 0m,
                MinQuantity = material?.MinQuantity ?? 0m,
                Location = material?.Location,
                Departments = rows
                    .GroupBy(p => new { p.DepartmentId, Name = p.Department != null ? p.Department.Name : string.Empty })
                    .Select(g => new MaterialDepartmentBreakdownDto
                    {
                        DepartmentId = g.Key.DepartmentId,
                        DepartmentName = g.Key.Name,
                        Quantity = g.Sum(p => p.Quantity)
                    })
                    .OrderByDescending(d => d.Quantity)
                    .ToList()
            };
        }

        return new ScanLookupDto
        {
            Id = product.Id,
            Name = product.Name,
            QrCode = product.QrCode,
            Quantity = product.Quantity,
            Reserved = product.ReservedQuantity,
            Available = product.Quantity - product.ReservedQuantity,
            Unit = product.Unit,
            DepartmentId = product.DepartmentId,
            DepartmentName = product.Department?.Name ?? string.Empty,
            InvoiceNumber = product.InvoiceNumber,
            QrPngBase64 = product.QrCode is null ? null : _qrCodeService.RenderPngBase64(product.QrCode),
            Material = aggregate
        };
    }
}