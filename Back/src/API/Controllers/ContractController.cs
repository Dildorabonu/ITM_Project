using API.Authorization;
using Application.DTOs.Contracts;
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
public class ContractController : ControllerBase
{
    private readonly IContractService _contractService;
    private readonly IAttachmentService _attachmentService;

    public ContractController(IContractService contractService, IAttachmentService attachmentService)
    {
        _contractService = contractService;
        _attachmentService = attachmentService;
    }

    // ── Claim helperlari ─────────────────────────────────────────────────────

    private bool TryGetUserId(out Guid userId)
        => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    // Shartnomani ko'rish huquqi: "View" — faqat o'ziga biriktirilganlar,
    // "ViewAll" — barchasi. `viewAll` shu yerda aniqlanib servisga uzatiladi.
    private bool TryGetContractScope(string module, out bool viewAll)
    {
        viewAll = User.HasClaim("perm", $"{module}.ViewAll");
        return viewAll || User.HasClaim("perm", $"{module}.View");
    }

    // ── Contracts ────────────────────────────────────────────────────────────

    // Dropdown/lookup ro'yxati — yengil `ContractSummaryDto` qaytaradi.
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? isActive = null)
    {
        if (!TryGetContractScope("Contracts", out var viewAll))
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var result = await _contractService.GetAllAsync(userId, viewAll, isActive);
        return Ok(result);
    }

    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] ContractStatus? status = null,
        [FromQuery] ContractType? contractType = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] bool excludeCompleted = false,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = false)
    {
        if (!TryGetContractScope("Contracts", out var viewAll))
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _contractService.GetPagedAsync(userId, viewAll, pagination, search, status, contractType, isActive, excludeCompleted, sortBy, sortDesc);
        return Ok(result);
    }

    // GET /api/contract/pending-pickup-count — mijoz to'liq olib ketmagan
    // yakunlangan shartnomalar soni (arxiv tabidagi indikator uchun).
    [HttpGet("pending-pickup-count")]
    public async Task<IActionResult> GetPendingPickupCount()
    {
        if (!TryGetContractScope("Contracts", out var viewAll))
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var result = await _contractService.GetPendingPickupCountAsync(userId, viewAll);
        return Ok(result);
    }

    // Diqqat: bu endpoint ataylab `[HasPermission]` siz — texnik chizma sahifasi
    // uni Contracts huquqisiz ham chaqiradi. Faqat `[Authorize]` bilan himoyalangan.
    [HttpGet("{id:guid}/products-lookup")]
    public async Task<IActionResult> GetProductsLookup(Guid id)
    {
        var result = await _contractService.GetProductsLookupAsync(id);
        return Ok(result);
    }

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _contractService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ContractCreateDto dto)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var result = await _contractService.CreateAsync(dto, userId);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(201, result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ContractUpdateDto dto)
    {
        var result = await _contractService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return result.StatusCode == 404 ? NotFound(result) : BadRequest(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPatch("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, [FromBody] ContractDeactivateDto dto)
    {
        var result = await _contractService.DeactivateAsync(id, dto);

        if (!result.Succeeded)
            return result.StatusCode == 404 ? NotFound(result) : BadRequest(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id)
    {
        var result = await _contractService.ActivateAsync(id);

        if (!result.Succeeded)
            return result.StatusCode == 404 ? NotFound(result) : BadRequest(result);

        return Ok(result);
    }

    // ── My Production Tasks ───────────────────────────────────────────────────

    [HttpGet("my-tasks")]
    public async Task<IActionResult> GetMyProductionTasks([FromQuery] bool? isActive = null)
    {
        if (!TryGetContractScope("Tasks", out var viewAll))
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var result = await _contractService.GetMyProductionTasksAsync(userId, viewAll, isActive);
        return Ok(result);
    }

    // ── Readiness Overview (texnik chizma + TP + me'yoriy sarf) ───────────────

    [HttpGet("readiness")]
    public async Task<IActionResult> GetReadinessOverview(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null)
    {
        if (!TryGetContractScope("TechProcess", out var viewAll))
            return Forbid();

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var pagination = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _contractService.GetReadinessOverviewAsync(userId, viewAll, pagination, search, isActive);
        return StatusCode(result.StatusCode, result);
    }

    // ── Users ────────────────────────────────────────────────────────────────

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/users")]
    public async Task<IActionResult> GetUsers(Guid id)
    {
        var result = await _contractService.GetUsersAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    // ── Files ────────────────────────────────────────────────────────────────
    //
    // Uch xil fayl to'plami bitta Attachment servisiga tayanadi va faqat
    // `entityType` bilan farqlanadi: shartnoma fayllari, shartnoma TZ fayllari
    // va mahsulot TZ fayllari. Route'lar alohida, mantiq esa umumiy helperlarda.

    private const string EntityType          = "contracts";
    private const string TzEntityType        = "contract-tz";
    private const string ProductTzEntityType = "contract-product-tz";

    private const int MaxUploadBytes = 50 * 1024 * 1024; // 50 MB

    private async Task<IActionResult> UploadAsync(string entityType, Guid entityId, IFormFile file)
    {
        if (!FileValidator.TryValidate(file, out var validationError))
            return BadRequest(validationError);

        if (!TryGetUserId(out var userId))
            return Unauthorized();

        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            entityType, entityId,
            stream, file.FileName, file.ContentType, file.Length,
            userId);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(201, result);
    }

    // Fayl diskdan oqim (stream) bilan uzatiladi — butun faylni xotiraga
    // o'qib olish 50 MB gacha bo'lgan yuklamalarda keraksiz yuk edi.
    private async Task<IActionResult> DownloadAsync(string entityType, Guid entityId, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(entityType, entityId, fileId);

        if (!result.Succeeded)
            return NotFound(result);

        var (filePath, contentType, fileName) = result.Result;
        return PhysicalFile(filePath, contentType, fileName, enableRangeProcessing: true);
    }

    private async Task<IActionResult> DeleteFileAsync(string entityType, Guid entityId, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(entityType, entityId, fileId);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
        => Ok(await _attachmentService.GetAllAsync(EntityType, id));

    [HasPermission("Contracts.Update")]
    [HttpPost("{id:guid}/files")]
    [RequestSizeLimit(MaxUploadBytes)]
    public Task<IActionResult> UploadFile(Guid id, IFormFile file)
        => UploadAsync(EntityType, id, file);

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public Task<IActionResult> DownloadFile(Guid id, Guid fileId)
        => DownloadAsync(EntityType, id, fileId);

    [HasPermission("Contracts.Update")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public Task<IActionResult> DeleteFile(Guid id, Guid fileId)
        => DeleteFileAsync(EntityType, id, fileId);

    // ── TZ Files ─────────────────────────────────────────────────────────────

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/tz-files")]
    public async Task<IActionResult> GetTzFiles(Guid id)
        => Ok(await _attachmentService.GetAllAsync(TzEntityType, id));

    [HasPermission("Contracts.Update")]
    [HttpPost("{id:guid}/tz-files")]
    [RequestSizeLimit(MaxUploadBytes)]
    public Task<IActionResult> UploadTzFile(Guid id, IFormFile file)
        => UploadAsync(TzEntityType, id, file);

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/tz-files/{fileId:guid}/download")]
    public Task<IActionResult> DownloadTzFile(Guid id, Guid fileId)
        => DownloadAsync(TzEntityType, id, fileId);

    [HasPermission("Contracts.Update")]
    [HttpDelete("{id:guid}/tz-files/{fileId:guid}")]
    public Task<IActionResult> DeleteTzFile(Guid id, Guid fileId)
        => DeleteFileAsync(TzEntityType, id, fileId);

    // ── Product TZ Files ─────────────────────────────────────────────────────
    //
    // Bu to'plam mahsulot Id'siga bog'lanadi; route'dagi shartnoma Id'si faqat
    // manzil ierarxiyasi uchun.

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/products/{productId:guid}/tz-files")]
    public async Task<IActionResult> GetProductTzFiles(Guid id, Guid productId)
        => Ok(await _attachmentService.GetAllAsync(ProductTzEntityType, productId));

    [HasPermission("Contracts.Update")]
    [HttpPost("{id:guid}/products/{productId:guid}/tz-files")]
    [RequestSizeLimit(MaxUploadBytes)]
    public Task<IActionResult> UploadProductTzFile(Guid id, Guid productId, IFormFile file)
        => UploadAsync(ProductTzEntityType, productId, file);

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/products/{productId:guid}/tz-files/{fileId:guid}/download")]
    public Task<IActionResult> DownloadProductTzFile(Guid id, Guid productId, Guid fileId)
        => DownloadAsync(ProductTzEntityType, productId, fileId);

    [HasPermission("Contracts.Update")]
    [HttpDelete("{id:guid}/products/{productId:guid}/tz-files/{fileId:guid}")]
    public Task<IActionResult> DeleteProductTzFile(Guid id, Guid productId, Guid fileId)
        => DeleteFileAsync(ProductTzEntityType, productId, fileId);
}
