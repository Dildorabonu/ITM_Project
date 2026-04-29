using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using QRCoder;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Application.Services.Impl;

public class RequisitionService : IRequisitionService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;

    public RequisitionService(DatabaseContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(
        Guid currentUserId, bool viewAll, RequisitionStatus? status = null)
    {
        var query = _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
            query = query.Where(r => r.CreatedBy == currentUserId);

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<RequisitionResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<RequisitionResponseDto>.Failure([$"Requisition '{id}' topilmadi."], 404);

        return ApiResult<RequisitionResponseDto>.Success(MapToResponse(r));
    }

    public async Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.RequisitionNo))
            return ApiResult<Guid>.Failure(["Talabnoma nomini kiriting."]);

        if (dto.Type == RequisitionType.Contract && dto.ContractId is null)
            return ApiResult<Guid>.Failure(["Shartnoma bo'yicha talabnomada ContractId majburiy."]);

        if (dto.Type == RequisitionType.Individual && dto.DepartmentId is null)
            return ApiResult<Guid>.Failure(["Individual talabnomada DepartmentId majburiy."]);

        if (dto.Items.Count == 0)
            return ApiResult<Guid>.Failure(["Kamida bitta material kerak."]);

        foreach (var item in dto.Items)
        {
            if (item.MaterialId is null && string.IsNullOrWhiteSpace(item.FreeTextName))
                return ApiResult<Guid>.Failure(["Har bir materialda MaterialId yoki nomi ko'rsatilishi shart."]);
        }

        var no = dto.RequisitionNo.Trim();
        var taken = await _context.Requisitions.AnyAsync(r => r.RequisitionNo == no);
        if (taken)
            return ApiResult<Guid>.Failure(["Bunday nomli talabnoma allaqachon mavjud."]);

        var requisition = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = no,
            Type = dto.Type,
            Status = RequisitionStatus.PendingWarehouseCheck,
            ContractId = dto.ContractId,
            DepartmentId = dto.DepartmentId,
            Purpose = dto.Purpose,
            Notes = dto.Notes,
            SignerName = dto.SignerName,
            SignerTitle = dto.SignerTitle,
            SignDate = dto.SignDate,
            CreatedBy = createdBy,
            Items = dto.Items.Select(i => new RequisitionItem
            {
                Id = Guid.NewGuid(),
                MaterialId = i.MaterialId,
                FreeTextName = i.FreeTextName,
                FreeTextUnit = i.FreeTextUnit,
                FreeTextSpec = i.FreeTextSpec,
                FreeTextPhoto = i.FreeTextPhoto,
                Quantity = i.Quantity,
                Notes = i.Notes
            }).ToList()
        };

        _context.Requisitions.Add(requisition);
        await _context.SaveChangesAsync();

        // Omborchilarga bildirishnoma
        await NotifyWarehouseCheckersAsync(requisition);

        return ApiResult<Guid>.Success(requisition.Id);
    }

    public async Task<ApiResult<List<Guid>>> WarehouseCheckAsync(Guid id, RequisitionWarehouseCheckDto dto, Guid checkerId)
    {
        var r = await _context.Requisitions
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r is null)
            return ApiResult<List<Guid>>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingWarehouseCheck)
            return ApiResult<List<Guid>>.Failure(["Faqat ombor tekshiruvini kutayotgan talabnomani tekshirish mumkin."]);

        var checker = await _context.Users.FindAsync(checkerId);
        if (checker is null)
            return ApiResult<List<Guid>>.Failure(["Omborchi topilmadi."], 404);

        // Har bir item ga AvailableQuantity yozish
        var checkMap = dto.Items.ToDictionary(i => i.ItemId);

        foreach (var item in r.Items)
        {
            if (!checkMap.TryGetValue(item.Id, out var check))
                return ApiResult<List<Guid>>.Failure([$"Item '{item.Id}' uchun tekshiruv natijasi yuborilmagan."]);

            if (check.AvailableQuantity < 0)
                return ApiResult<List<Guid>>.Failure(["Mavjud miqdor manfiy bo'lishi mumkin emas."]);

            if (check.AvailableQuantity > item.Quantity)
                return ApiResult<List<Guid>>.Failure([$"Mavjud miqdor so'ralgan miqdordan ({item.Quantity}) ko'p bo'lishi mumkin emas."]);

            item.AvailableQuantity = check.AvailableQuantity;
            item.WarehouseNotes = check.WarehouseNotes;
        }

        r.WarehouseCheckedBy = checkerId;
        r.WarehouseCheckedAt = DateTime.UtcNow;
        r.WarehouseCheckQrCodeData = GenerateWarehouseQrCode(r, checker);

        // Avto-bo'linish: omborchi tekshiruvi tugagach darrov 2 ta child yaratiladi
        var children = BuildChildren(r);

        if (children.Count == 0)
            return ApiResult<List<Guid>>.Failure(["Talabnomada bo'lish uchun item topilmadi."]);

        foreach (var c in children) _context.Requisitions.Add(c);
        r.Status = RequisitionStatus.Split;

        await _context.SaveChangesAsync();

        // Yaratuvchiga xabar
        await _notificationService.CreateAsync(r.CreatedBy,
            $"Ombor tekshiruvi yakunlandi: {r.RequisitionNo}",
            $"Talabnomangiz tekshirildi va {children.Count} ta yo'nalishga bo'lindi.",
            NotificationType.Info);

        // Direktorlarga bildirishnoma
        await NotifyDirectorsAsync(r.RequisitionNo, children.Count);

        return ApiResult<List<Guid>>.Success(children.Select(c => c.Id).ToList());
    }

    public async Task<ApiResult<List<Guid>>> SplitAsync(Guid id, Guid currentUserId)
    {
        var parent = await _context.Requisitions
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (parent is null)
            return ApiResult<List<Guid>>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (parent.Status != RequisitionStatus.WarehouseChecked)
            return ApiResult<List<Guid>>.Failure(["Faqat ombor tekshiruvidan o'tgan talabnomani bo'lish mumkin."]);

        if (parent.CreatedBy != currentUserId)
            return ApiResult<List<Guid>>.Failure(["Faqat talabnoma yaratuvchisi uni bo'lib yuborishi mumkin."], 403);

        var children = BuildChildren(parent);

        if (children.Count == 0)
            return ApiResult<List<Guid>>.Failure(["Bo'lish uchun item topilmadi."]);

        foreach (var c in children) _context.Requisitions.Add(c);
        parent.Status = RequisitionStatus.Split;

        await _context.SaveChangesAsync();

        await NotifyDirectorsAsync(parent.RequisitionNo, children.Count);

        return ApiResult<List<Guid>>.Success(children.Select(c => c.Id).ToList());
    }

    private static List<Requisition> BuildChildren(Requisition parent)
    {
        var warehouseItems = new List<RequisitionItem>();
        var purchaseItems = new List<RequisitionItem>();

        foreach (var item in parent.Items)
        {
            var available = item.AvailableQuantity ?? 0m;
            var deficit = item.Quantity - available;

            if (available > 0)
            {
                warehouseItems.Add(new RequisitionItem
                {
                    Id = Guid.NewGuid(),
                    MaterialId = item.MaterialId,
                    FreeTextName = item.FreeTextName,
                    FreeTextUnit = item.FreeTextUnit,
                    FreeTextSpec = item.FreeTextSpec,
                    FreeTextPhoto = item.FreeTextPhoto,
                    Quantity = available,
                    OriginalQuantity = item.Quantity,
                    Notes = item.Notes
                });
            }

            if (deficit > 0)
            {
                purchaseItems.Add(new RequisitionItem
                {
                    Id = Guid.NewGuid(),
                    MaterialId = item.MaterialId,
                    FreeTextName = item.FreeTextName,
                    FreeTextUnit = item.FreeTextUnit,
                    FreeTextSpec = item.FreeTextSpec,
                    FreeTextPhoto = item.FreeTextPhoto,
                    Quantity = deficit,
                    OriginalQuantity = item.Quantity,
                    Notes = item.Notes
                });
            }
        }

        var children = new List<Requisition>();

        if (warehouseItems.Count > 0)
        {
            children.Add(new Requisition
            {
                Id = Guid.NewGuid(),
                RequisitionNo = $"{parent.RequisitionNo}-W",
                Type = parent.Type,
                Status = RequisitionStatus.PendingApproval,
                ContractId = parent.ContractId,
                DepartmentId = parent.DepartmentId,
                Purpose = parent.Purpose,
                Notes = parent.Notes,
                SignerName = parent.SignerName,
                SignerTitle = parent.SignerTitle,
                SignDate = parent.SignDate,
                ParentRequisitionId = parent.Id,
                Source = RequisitionSource.Warehouse,
                CreatedBy = parent.CreatedBy,
                WarehouseCheckedBy = parent.WarehouseCheckedBy,
                WarehouseCheckedAt = parent.WarehouseCheckedAt,
                WarehouseCheckQrCodeData = parent.WarehouseCheckQrCodeData,
                Items = warehouseItems
            });
        }

        if (purchaseItems.Count > 0)
        {
            children.Add(new Requisition
            {
                Id = Guid.NewGuid(),
                RequisitionNo = $"{parent.RequisitionNo}-P",
                Type = parent.Type,
                Status = RequisitionStatus.PendingApproval,
                ContractId = parent.ContractId,
                DepartmentId = parent.DepartmentId,
                Purpose = parent.Purpose,
                Notes = parent.Notes,
                SignerName = parent.SignerName,
                SignerTitle = parent.SignerTitle,
                SignDate = parent.SignDate,
                ParentRequisitionId = parent.Id,
                Source = RequisitionSource.Purchase,
                CreatedBy = parent.CreatedBy,
                WarehouseCheckedBy = parent.WarehouseCheckedBy,
                WarehouseCheckedAt = parent.WarehouseCheckedAt,
                WarehouseCheckQrCodeData = parent.WarehouseCheckQrCodeData,
                Items = purchaseItems
            });
        }

        return children;
    }

    public async Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingApproval)
            return ApiResult<bool>.Failure(["Faqat tasdiqlash kutayotgan talabnomani tasdiqlash mumkin."]);

        if (r.Source is null)
            return ApiResult<bool>.Failure(["Talabnomada source aniqlanmagan."]);

        var director = await _context.Users.FindAsync(directorId);
        if (director is null)
            return ApiResult<bool>.Failure(["Direktor topilmadi."], 404);

        r.Status = r.Source == RequisitionSource.Warehouse
            ? RequisitionStatus.ReadyForWarehouseRelease
            : RequisitionStatus.ReadyForPurchase;
        r.ApprovedBy = directorId;
        r.ApprovedAt = DateTime.UtcNow;
        r.QrCodeData = GenerateQrCode(r, director);

        await _context.SaveChangesAsync();

        var sourceLabel = r.Source == RequisitionSource.Warehouse ? "ombordan olishga" : "sotib olishga";
        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma tasdiqlandi: {r.RequisitionNo}",
            $"Talabnomangiz tasdiqlandi va {sourceLabel} yo'naltirildi.",
            NotificationType.Info);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto)
    {
        var r = await _context.Requisitions.FindAsync(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingApproval)
            return ApiResult<bool>.Failure(["Faqat tasdiqlash kutayotgan talabnomani rad etish mumkin."]);

        r.Status = RequisitionStatus.Rejected;
        r.RejectionReason = dto.RejectionReason;
        r.ApprovedBy = directorId;
        r.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma rad etildi: {r.RequisitionNo}",
            $"Sabab: {dto.RejectionReason}",
            NotificationType.Warning);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> DeleteAsync(Guid id, Guid currentUserId)
    {
        var r = await _context.Requisitions
            .Include(r => r.Items)
            .Include(r => r.Children)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status is RequisitionStatus.ReadyForWarehouseRelease
            or RequisitionStatus.ReadyForPurchase
            or RequisitionStatus.Split)
            return ApiResult<bool>.Failure(["Tasdiqlangan yoki bo'lib yuborilgan talabnomani o'chirib bo'lmaydi."]);

        if (r.Children.Count > 0)
            return ApiResult<bool>.Failure(["Bo'lingan talabnomani o'chirib bo'lmaydi."]);

        _context.RequisitionItems.RemoveRange(r.Items);
        _context.Requisitions.Remove(r);
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }

    // ─── Yordamchi metodlar ───────────────────────────────────────────────────

    private async Task<Requisition?> GetWithIncludes(Guid id) =>
        await _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(r => r.Id == id);

    private async System.Threading.Tasks.Task NotifyWarehouseCheckersAsync(Requisition r)
    {
        var checkers = await _context.Users
            .Include(u => u.Role).ThenInclude(role => role!.RolePermissions).ThenInclude(rp => rp.Permission)
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.WarehouseCheck))
            .ToListAsync();

        foreach (var checker in checkers)
        {
            await _notificationService.CreateAsync(checker.Id,
                $"Yangi talabnoma tekshiruvga: {r.RequisitionNo}",
                "Ombor tekshiruvini kutmoqda.",
                NotificationType.Info);
        }
    }

    private async System.Threading.Tasks.Task NotifyDirectorsAsync(string parentNo, int childCount)
    {
        var directors = await _context.Users
            .Include(u => u.Role).ThenInclude(role => role!.RolePermissions).ThenInclude(rp => rp.Permission)
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.Approve))
            .ToListAsync();

        foreach (var director in directors)
        {
            await _notificationService.CreateAsync(director.Id,
                $"Yangi tasdiqlash kerak: {parentNo}",
                $"{childCount} ta yangi talabnoma tasdiqlash kutmoqda.",
                NotificationType.Info);
        }
    }

    private static string GenerateQrCode(Requisition r, User director)
    {
        var directorFullName = $"{director.FirstName} {director.LastName}";
        var approvedAt = r.ApprovedAt?.ToString("yyyy-MM-ddTHH:mm:ss") ?? string.Empty;

        var raw = $"{r.Id}|{r.RequisitionNo}|{director.Id}|{approvedAt}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16];

        var payload = JsonSerializer.Serialize(new
        {
            id = r.Id,
            no = r.RequisitionNo,
            approvedBy = directorFullName,
            approvedAt,
            hash
        });

        return RenderQr(payload);
    }

    private static string GenerateWarehouseQrCode(Requisition r, User checker)
    {
        var checkerFullName = $"{checker.FirstName} {checker.LastName}";
        var checkedAt = r.WarehouseCheckedAt?.ToString("yyyy-MM-ddTHH:mm:ss") ?? string.Empty;

        var raw = $"WH|{r.Id}|{r.RequisitionNo}|{checker.Id}|{checkedAt}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16];

        var payload = JsonSerializer.Serialize(new
        {
            id = r.Id,
            no = r.RequisitionNo,
            checkedBy = checkerFullName,
            checkedAt,
            hash
        });

        return RenderQr(payload);
    }

    private static string RenderQr(string payload)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(6);
        return Convert.ToBase64String(pngBytes);
    }

    private static string StatusLabel(RequisitionStatus s) => s switch
    {
        RequisitionStatus.Draft                    => "Qoralama",
        RequisitionStatus.PendingWarehouseCheck    => "Ombor tekshiruvida",
        RequisitionStatus.WarehouseChecked         => "Tekshiruv yakunlandi",
        RequisitionStatus.Split                    => "Bo'lib yuborilgan",
        RequisitionStatus.PendingApproval          => "Tasdiqlash kutilmoqda",
        RequisitionStatus.Rejected                 => "Rad etilgan",
        RequisitionStatus.ReadyForWarehouseRelease => "Ombordan olishga",
        RequisitionStatus.ReadyForPurchase         => "Sotib olishga",
        _                                          => s.ToString()
    };

    private static string SourceLabel(RequisitionSource s) => s switch
    {
        RequisitionSource.Warehouse => "Ombordan olinadigan",
        RequisitionSource.Purchase  => "Sotib olinadigan",
        _                           => s.ToString()
    };

    private static RequisitionResponseDto MapToResponse(Requisition r) => new()
    {
        Id = r.Id,
        RequisitionNo = r.RequisitionNo,
        Type = r.Type,
        TypeLabel = r.Type switch
        {
            RequisitionType.Contract   => "Shartnoma bo'yicha",
            RequisitionType.Individual => "Individual",
            _                          => r.Type.ToString()
        },
        Status = r.Status,
        StatusLabel = StatusLabel(r.Status),
        ContractId = r.ContractId,
        ContractNo = r.Contract?.ContractNo,
        DepartmentId = r.DepartmentId,
        DepartmentName = r.Department?.Name,
        Purpose = r.Purpose,
        Notes = r.Notes,
        RejectionReason = r.RejectionReason,
        SignerName = r.SignerName,
        SignerTitle = r.SignerTitle,
        SignDate = r.SignDate,
        ParentRequisitionId = r.ParentRequisitionId,
        ParentRequisitionNo = r.Parent?.RequisitionNo,
        Source = r.Source,
        SourceLabel = r.Source.HasValue ? SourceLabel(r.Source.Value) : null,
        Children = r.Children.Select(c => new RequisitionChildSummaryDto
        {
            Id = c.Id,
            RequisitionNo = c.RequisitionNo,
            Status = c.Status,
            StatusLabel = StatusLabel(c.Status),
            Source = c.Source ?? RequisitionSource.Warehouse,
            SourceLabel = c.Source.HasValue ? SourceLabel(c.Source.Value) : string.Empty,
            ItemCount = c.Items.Count
        }).ToList(),
        WarehouseCheckedBy = r.WarehouseCheckedBy,
        WarehouseCheckedByName = r.WarehouseChecker is null ? null : $"{r.WarehouseChecker.FirstName} {r.WarehouseChecker.LastName}",
        WarehouseCheckedAt = r.WarehouseCheckedAt,
        WarehouseCheckQrCodeData = r.WarehouseCheckQrCodeData,
        ApprovedBy = r.ApprovedBy,
        ApprovedByName = r.Approver is null ? null : $"{r.Approver.FirstName} {r.Approver.LastName}",
        ApprovedAt = r.ApprovedAt,
        QrCodeData = r.QrCodeData,
        CreatedBy = r.CreatedBy,
        CreatedByName = r.Creator is null ? string.Empty : $"{r.Creator.FirstName} {r.Creator.LastName}",
        CreatedAt = r.CreatedAt,
        Items = r.Items.Select(i => new RequisitionItemResponseDto
        {
            Id = i.Id,
            MaterialId = i.MaterialId,
            MaterialName = i.Material?.Name ?? i.FreeTextName ?? string.Empty,
            MaterialCode = i.Material?.Code ?? string.Empty,
            Unit = i.Material?.Unit ?? i.FreeTextUnit ?? string.Empty,
            FreeTextSpec = i.FreeTextSpec,
            FreeTextPhoto = i.FreeTextPhoto,
            Quantity = i.Quantity,
            Notes = i.Notes,
            AvailableQuantity = i.AvailableQuantity,
            WarehouseNotes = i.WarehouseNotes,
            OriginalQuantity = i.OriginalQuantity
        }).ToList()
    };
}
