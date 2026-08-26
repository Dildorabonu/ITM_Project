using API.Authorization;
using Application.DTOs.TechProcesses;
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
public class TechProcessController : ControllerBase
{
    private readonly ITechProcessService _techProcessService;
    private readonly IAttachmentService _attachmentService;

    public TechProcessController(ITechProcessService techProcessService, IAttachmentService attachmentService)
    {
        _techProcessService = techProcessService;
        _attachmentService = attachmentService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/techprocess
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProcessStatus? status = null, [FromQuery] bool? isActive = null)
    {
        var viewAll = User.HasClaim("perm", "TechProcess.ViewAll");

        if (!viewAll && !User.HasClaim("perm", "TechProcess.View"))
            return Forbid();

        // The scope filter is only applied when the caller lacks ViewAll, so the
        // id is only needed then.
        var userId = viewAll ? Guid.Empty : CurrentUserId;
        var result = await _techProcessService.GetAllAsync(userId, viewAll, status, isActive);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/techprocess/{id}
    [HasPermission("TechProcess.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _techProcessService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/techprocess
    [HasPermission("TechProcess.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TechProcessCreateDto dto)
    {
        var result = await _techProcessService.CreateAsync(dto);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TechProcessUpdateDto dto)
    {
        var result = await _techProcessService.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}/approve
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var result = await _techProcessService.ApproveAsync(id, CurrentUserId);
        return StatusCode(result.StatusCode, result);
    }

    // ── Files ────────────────────────────────────────────────────────────────

    private const string EntityType = "techprocess";

    [HasPermission("TechProcess.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechProcess.Create")]
    [HttpPost("{id:guid}/files")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<IActionResult> UploadFile(Guid id, IFormFile file)
    {
        if (!FileValidator.TryValidate(file, out var validationError))
            return BadRequest(validationError);

        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            EntityType, id, stream, file.FileName, file.ContentType, file.Length, CurrentUserId);

        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechProcess.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(EntityType, id, fileId);
        if (!result.Succeeded)
            return NotFound(result);

        var (filePath, contentType, fileName) = result.Result;
        return PhysicalFile(filePath, contentType, fileName, enableRangeProcessing: true);
    }
}
