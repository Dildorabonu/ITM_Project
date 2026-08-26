using API.Authorization;
using Application.DTOs.Requisitions;
using Application.Helpers;
using Application.Services;
using Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RequisitionController : ControllerBase
{
    private readonly IRequisitionService _requisitionService;
    private readonly IAttachmentService _attachmentService;

    private const string EntityType = "requisitions";

    public RequisitionController(IRequisitionService requisitionService, IAttachmentService attachmentService)
    {
        _requisitionService = requisitionService;
        _attachmentService = attachmentService;
    }

    /// Navbat ekranlari uchun ro'yxat — materiallarning ko'rinadigan maydonlari bilan,
    /// QR imzolari va child grafisiz.
    [HasPermission("Requisitions.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] RequisitionStatus? status = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.GetAllAsync(userId.Value, ViewAll, status);
        return Ok(result);
    }

    [HasPermission("Requisitions.View")]
    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] RequisitionStatus? status = null,
        [FromQuery] bool? completed = null,
        [FromQuery] bool? rejected = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _requisitionService.GetPagedAsync(userId.Value, ViewAll, pagination, search, status, completed, rejected);
        return Ok(result);
    }

    /// Sidebar badge uchun: tekshiruv kutayotgan talabnomalar soni.
    [HasPermission("WarehouseCheck.View")]
    [HttpGet("pending-check-count")]
    public async Task<IActionResult> GetPendingCheckCount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.GetCountByStatusAsync(
            userId.Value, ViewAll, RequisitionStatus.PendingWarehouseCheck);
        return Ok(result);
    }

    /// Talabnomalar sahifasidagi "Tasdiqlash" badge'i uchun: tasdiqlash kutayotganlar soni.
    /// Ilgari buning uchun butun ro'yxat tortilib, faqat uzunligi olinardi.
    [HasPermission("Requisitions.Approve")]
    [HttpGet("pending-approval-count")]
    public async Task<IActionResult> GetPendingApprovalCount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.GetCountByStatusAsync(
            userId.Value, ViewAll, RequisitionStatus.PendingApproval);
        return Ok(result);
    }

    /// Faol ro'yxat ostidagi "Yaqinda yakunlangan" bloki uchun.
    [HasPermission("Requisitions.View")]
    [HttpGet("recent-completed")]
    public async Task<IActionResult> GetRecentCompleted([FromQuery] int days = 7)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.GetRecentCompletedAsync(userId.Value, ViewAll, days);
        return Ok(result);
    }

    /// To'liq detal: materiallar, childlar va QR imzolari faqat shu javobda keladi.
    [HasPermission("Requisitions.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _requisitionService.GetByIdAsync(id);
        if (!result.Succeeded) return NotFound(result);
        return Ok(result);
    }

    [HasPermission("Requisitions.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RequisitionCreateDto dto)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.CreateAsync(dto, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>Omborchi tekshiruvini yakunlaydi va avto-bo'linish: PendingWarehouseCheck → Split. Yaratilgan child IDlarni qaytaradi.</summary>
    [HasPermission("Requisitions.WarehouseCheck")]
    [HttpPost("{id:guid}/warehouse-check")]
    public async Task<IActionResult> WarehouseCheck(Guid id, [FromBody] RequisitionWarehouseCheckDto dto)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.WarehouseCheckAsync(id, dto, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>Direktor tasdiqlaydi: PendingApproval → ReadyForWarehouseRelease yoki ReadyForPurchase + QR</summary>
    [HasPermission("Requisitions.Approve")]
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.ApproveAsync(id, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>Direktor rad etadi: PendingApproval → Rejected</summary>
    [HasPermission("Requisitions.Approve")]
    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RequisitionRejectDto dto)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.RejectAsync(id, userId.Value, dto);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>Omborchi mahsulotlarni chiqarib beradi: ReadyForWarehouseRelease → Released. Bo'lim omboriga avto-qo'shish.</summary>
    [HasPermission("Requisitions.WarehouseCheck")]
    [HttpPost("{id:guid}/release")]
    public async Task<IActionResult> Release(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.ReleaseAsync(id, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    /// <summary>Omborchi sotib olingan mahsulotni omborga qabul qiladi: ReadyForPurchase → ReadyForWarehouseRelease.</summary>
    [HasPermission("Requisitions.WarehouseCheck")]
    [HttpPost("{id:guid}/receive-purchase")]
    public async Task<IActionResult> ReceivePurchase(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.ReceivePurchaseAsync(id, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    // ── Files ────────────────────────────────────────────────────────────────

    [HasPermission("Requisitions.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return Ok(result);
    }

    [HttpPost("{id:guid}/files")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
    public async Task<IActionResult> UploadFile(Guid id, IFormFile file, [FromQuery] string? label = null)
    {
        if (!User.HasClaim("perm", "Requisitions.Create") &&
            !User.HasClaim("perm", "Requisitions.WarehouseCheck"))
            return Forbid();

        if (!FileValidator.TryValidate(file, out var validationError))
            return BadRequest(validationError);

        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            EntityType, id,
            stream, file.FileName, file.ContentType, file.Length,
            userId.Value, label);

        if (!result.Succeeded) return BadRequest(result);
        return StatusCode(201, result);
    }

    // Fayl diskdan oqim (stream) bilan uzatiladi — butun faylni xotiraga
    // o'qib olish 50 MB gacha bo'lgan yuklamalarda keraksiz yuk edi.
    [HasPermission("Requisitions.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(EntityType, id, fileId);
        if (!result.Succeeded) return NotFound(result);

        var (filePath, contentType, fileName) = result.Result;
        return PhysicalFile(filePath, contentType, fileName, enableRangeProcessing: true);
    }

    [HasPermission("Requisitions.Create")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);
        if (!result.Succeeded) return NotFound(result);
        return Ok(result);
    }

    /// Requisitions.ViewAll — boshqalarning talabnomalarini ham ko'rish huquqi.
    private bool ViewAll => User.HasClaim("perm", "Requisitions.ViewAll");

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
