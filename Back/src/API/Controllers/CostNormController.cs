using API.Authorization;
using Application.DTOs.CostNorms;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CostNormController : ControllerBase
{
    private const string EntityType = "costnorm";

    private readonly ICostNormService _costNormService;
    private readonly IAttachmentService _attachmentService;

    public CostNormController(ICostNormService costNormService, IAttachmentService attachmentService)
    {
        _costNormService = costNormService;
        _attachmentService = attachmentService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/costnorm
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? contractId = null, [FromQuery] bool? isActive = null)
    {
        var canView = User.HasClaim("perm", "CostNorm.View");
        var viewAll = User.HasClaim("perm", "CostNorm.ViewAll");

        if (!canView && !viewAll)
            return Forbid();

        var result = await _costNormService.GetAllAsync(CurrentUserId, viewAll, contractId, isActive);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/costnorm/{id}
    [HasPermission("CostNorm.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _costNormService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/costnorm
    [HasPermission("CostNorm.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CostNormCreateDto dto)
    {
        var result = await _costNormService.CreateAsync(dto, CurrentUserId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/costnorm/{id}
    [HasPermission("CostNorm.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CostNormUpdateDto dto)
    {
        var result = await _costNormService.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    // PATCH /api/costnorm/{id}/approve
    [HasPermission("CostNorm.Update")]
    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await _costNormService.ApproveAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // ── Files ────────────────────────────────────────────────────────────────
    // Me'yoriy sarfning yagona fayli — Create/Update da server generatsiya qiladigan
    // DOCX. Shu sababli qo'lda yuklash/o'chirish endpointlari yo'q: ular keyingi
    // generatsiyada baribir o'chib ketardi.

    [HasPermission("CostNorm.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("CostNorm.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(EntityType, id, fileId);
        if (!result.Succeeded)
            return NotFound(result);

        // Faylni xotiraga to'liq o'qimasdan oqim orqali uzatamiz.
        var (filePath, contentType, fileName) = result.Result;
        return PhysicalFile(filePath, contentType, fileName, enableRangeProcessing: true);
    }
}
