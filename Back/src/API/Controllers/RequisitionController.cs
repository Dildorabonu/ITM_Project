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

    [HasPermission("Requisitions.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] RequisitionStatus? status = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var viewAll = User.HasClaim("perm", "Requisitions.ViewAll");
        var result = await _requisitionService.GetAllAsync(userId.Value, viewAll, status);
        return Ok(result);
    }

    [HasPermission("Requisitions.View")]
    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] RequisitionStatus? status = null,
        [FromQuery] bool? completed = null)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var viewAll = User.HasClaim("perm", "Requisitions.ViewAll");
        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _requisitionService.GetPagedAsync(userId.Value, viewAll, pagination, search, status, completed);
        return Ok(result);
    }

    /// Sidebar badge uchun: tekshiruv kutayotgan talabnomalar soni.
    [HasPermission("WarehouseCheck.View")]
    [HttpGet("pending-check-count")]
    public async Task<IActionResult> GetPendingCheckCount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var viewAll = User.HasClaim("perm", "Requisitions.ViewAll");
        var result = await _requisitionService.GetPendingWarehouseCheckCountAsync(userId.Value, viewAll);
        return Ok(result);
    }

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

    [Authorize]
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

    [HasPermission("Requisitions.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(EntityType, id, fileId);
        if (!result.Succeeded) return NotFound(result);

        var (filePath, contentType, fileName) = result.Result;
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, contentType, fileName);
    }

    [HasPermission("Requisitions.Create")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);
        if (!result.Succeeded) return NotFound(result);
        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
