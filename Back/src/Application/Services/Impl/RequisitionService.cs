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
            .Include(r => r.Contract)
            .Include(r => r.Department)
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
        if (dto.Type == RequisitionType.Contract && dto.ContractId is null)
            return ApiResult<Guid>.Failure(["Shartnoma bo'yicha talabnomada ContractId majburiy."]);

        if (dto.Type == RequisitionType.Individual && dto.DepartmentId is null)
            return ApiResult<Guid>.Failure(["Individual talabnomada DepartmentId majburiy."]);

        if (dto.Items.Count == 0)
            return ApiResult<Guid>.Failure(["Kamida bitta material kerak."]);

        // Har bir item: yoki MaterialId, yoki FreeTextName bo'lishi shart
        foreach (var item in dto.Items)
        {
            if (item.MaterialId is null && string.IsNullOrWhiteSpace(item.FreeTextName))
                return ApiResult<Guid>.Failure(["Har bir materialda MaterialId yoki nomi ko'rsatilishi shart."]);
        }

        var no = await GenerateRequisitionNo();

        var requisition = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = no,
            Type = dto.Type,
            Status = RequisitionStatus.Draft,
            ContractId = dto.ContractId,
            DepartmentId = dto.DepartmentId,
            Purpose = dto.Purpose,
            Notes = dto.Notes,
            CreatedBy = createdBy,
            Items = dto.Items.Select(i => new RequisitionItem
            {
                Id = Guid.NewGuid(),
                MaterialId = i.MaterialId,
                FreeTextName = i.FreeTextName,
                FreeTextUnit = i.FreeTextUnit,
                FreeTextSpec = i.FreeTextSpec,
                Quantity = i.Quantity,
                Notes = i.Notes
            }).ToList()
        };

        _context.Requisitions.Add(requisition);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(requisition.Id);
    }

    public async Task<ApiResult<bool>> SubmitAsync(Guid id, Guid currentUserId)
    {
        var r = await _context.Requisitions.FindAsync(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.CreatedBy != currentUserId)
            return ApiResult<bool>.Failure(["Faqat o'zingiz yaratgan talabnomani yuborishingiz mumkin."], 403);

        if (r.Status != RequisitionStatus.Draft)
            return ApiResult<bool>.Failure([$"Status '{r.Status}' — faqat Draft holatdagi talabnomani yuborish mumkin."]);

        r.Status = RequisitionStatus.Pending;
        await _context.SaveChangesAsync();

        // Direktorlarga bildirishnoma yuborish
        var directors = await _context.Users
            .Include(u => u.Role)
            .Where(u => u.Role != null && u.Role.Name == "Director" && u.IsActive)
            .ToListAsync();

        foreach (var director in directors)
        {
            await _notificationService.CreateAsync(director.Id,
                $"Yangi talabnoma: {r.RequisitionNo}",
                "Talabnoma tasdiqlash kutilmoqda.",
                NotificationType.Info);
        }

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.Pending)
            return ApiResult<bool>.Failure([$"Faqat Pending holatdagi talabnomani tasdiqlash mumkin."]);

        var director = await _context.Users.FindAsync(directorId);
        if (director is null)
            return ApiResult<bool>.Failure(["Direktor topilmadi."], 404);

        r.Status = RequisitionStatus.Approved;
        r.ApprovedBy = directorId;
        r.ApprovedAt = DateTime.UtcNow;
        r.QrCodeData = GenerateQrCode(r, director);

        await _context.SaveChangesAsync();

        // Yaratuvchiga xabar
        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma tasdiqlandi: {r.RequisitionNo}",
            "Talabnomangiz direktor tomonidan tasdiqlandi.",
            NotificationType.Info);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto)
    {
        var r = await _context.Requisitions.FindAsync(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.Pending)
            return ApiResult<bool>.Failure(["Faqat Pending holatdagi talabnomani rad etish mumkin."]);

        r.Status = RequisitionStatus.Rejected;
        r.RejectionReason = dto.RejectionReason;

        await _context.SaveChangesAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma rad etildi: {r.RequisitionNo}",
            $"Sabab: {dto.RejectionReason}",
            NotificationType.Warning);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> SendToWarehouseAsync(Guid id, Guid currentUserId)
    {
        var r = await _context.Requisitions.FindAsync(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.Approved)
            return ApiResult<bool>.Failure(["Faqat Approved holatdagi talabnomani omborga yuborish mumkin."]);

        r.Status = RequisitionStatus.SentToWarehouse;
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }

    // ─── Yordamchi metodlar ───────────────────────────────────────────────────

    private async Task<Requisition?> GetWithIncludes(Guid id) =>
        await _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(r => r.Id == id);

    private async Task<string> GenerateRequisitionNo()
    {
        var year = DateTime.UtcNow.Year;
        var count = await _context.Requisitions
            .CountAsync(r => r.CreatedAt.Year == year);
        return $"REQ-{year}-{(count + 1):D4}";
    }

    private static string GenerateQrCode(Requisition r, User director)
    {
        var directorFullName = $"{director.FirstName} {director.LastName}";
        var approvedAt = r.ApprovedAt?.ToString("yyyy-MM-ddTHH:mm:ss") ?? string.Empty;

        // Hash — soxtamas ekanligini tekshirish uchun
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

        using var qrGenerator = new QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(6);

        return Convert.ToBase64String(pngBytes);
    }

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
        StatusLabel = r.Status switch
        {
            RequisitionStatus.Draft            => "Qoralama",
            RequisitionStatus.Pending          => "Kutilmoqda",
            RequisitionStatus.Approved         => "Tasdiqlangan",
            RequisitionStatus.Rejected         => "Rad etilgan",
            RequisitionStatus.SentToWarehouse  => "Omborga yuborilgan",
            _                                  => r.Status.ToString()
        },
        ContractId = r.ContractId,
        ContractNo = r.Contract?.ContractNo,
        DepartmentId = r.DepartmentId,
        DepartmentName = r.Department?.Name,
        Purpose = r.Purpose,
        Notes = r.Notes,
        RejectionReason = r.RejectionReason,
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
            Quantity = i.Quantity,
            Notes = i.Notes
        }).ToList()
    };
}
