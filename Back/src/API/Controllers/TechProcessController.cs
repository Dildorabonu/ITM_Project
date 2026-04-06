using API.Authorization;
using Application.DTOs.TechProcesses;
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

    // GET /api/techprocess
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProcessStatus? status = null)
    {
        var canView = User.HasClaim("perm", "TechProcess.View");
        var viewAll = User.HasClaim("perm", "TechProcess.ViewAll");

        if (!canView && !viewAll)
            return Forbid();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.GetAllAsync(userId, viewAll, status);
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

    // GET /api/techprocess/by-contract/{contractId}
    [HasPermission("TechProcess.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _techProcessService.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/techprocess
    [HasPermission("TechProcess.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TechProcessCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.CreateAsync(dto, userId);
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
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.ApproveAsync(id, userId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}/send-to-warehouse
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}/send-to-warehouse")]
    public async Task<IActionResult> SendToWarehouse(Guid id)
    {
        var result = await _techProcessService.SendToWarehouseAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // DELETE /api/techprocess/{id}
    [HasPermission("TechProcess.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _techProcessService.DeleteAsync(id);
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
        if (file is null || file.Length == 0)
            return BadRequest("Fayl tanlanmagan.");

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            EntityType, id, stream, file.FileName, file.ContentType, file.Length, userId);

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
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath);
        return File(bytes, contentType, fileName);
    }

    [HasPermission("TechProcess.Delete")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);
        return StatusCode(result.StatusCode, result);
    }

}
