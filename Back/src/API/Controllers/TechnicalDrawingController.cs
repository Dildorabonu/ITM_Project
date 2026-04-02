using API.Authorization;
using Application.DTOs.TechnicalDrawings;
using Application.Services;
using Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TechnicalDrawingController : ControllerBase
{
    private readonly ITechnicalDrawingService _drawingService;
    private readonly IAttachmentService _attachmentService;

    public TechnicalDrawingController(ITechnicalDrawingService drawingService, IAttachmentService attachmentService)
    {
        _drawingService = drawingService;
        _attachmentService = attachmentService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] DrawingStatus? status = null)
    {
        var canView = User.HasClaim("perm", "TechnicalDrawings.View");
        var viewAll = User.HasClaim("perm", "TechnicalDrawings.ViewAll");

        if (!canView && !viewAll)
            return Forbid();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _drawingService.GetAllAsync(userId, viewAll, status);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _drawingService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TechnicalDrawingCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _drawingService.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TechnicalDrawingUpdateDto dto)
    {
        var result = await _drawingService.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.Update")]
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] DrawingStatusUpdateDto dto)
    {
        var result = await _drawingService.UpdateStatusAsync(id, dto.Status);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _drawingService.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // ── Files ────────────────────────────────────────────────────────────────

    private const string EntityType = "technicaldrawings";

    [HasPermission("TechnicalDrawings.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.Update")]
    [HttpPost("{id:guid}/files")]
    [RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<IActionResult> UploadFile(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Fayl tanlanmagan.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            EntityType, id, stream, file.FileName, file.ContentType, file.Length, userId);

        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("TechnicalDrawings.View")]
    [HttpGet("{id:guid}/files/{fileId:guid}/download")]
    public async Task<IActionResult> DownloadFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.GetForDownloadAsync(EntityType, id, fileId);
        if (!result.Succeeded)
            return NotFound(result);

        var (filePath, contentType, fileName) = result.Result;
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, contentType, fileName);
    }

    [HasPermission("TechnicalDrawings.Delete")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);
        return StatusCode(result.StatusCode, result);
    }
}
