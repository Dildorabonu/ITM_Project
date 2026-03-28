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
    private readonly ICostNormService _costNormService;
    private readonly IAttachmentService _attachmentService;

    public CostNormController(ICostNormService costNormService, IAttachmentService attachmentService)
    {
        _costNormService = costNormService;
        _attachmentService = attachmentService;
    }

    // GET /api/costnorm
    [HasPermission("CostNorm.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? contractId = null)
    {
        var result = await _costNormService.GetAllAsync(contractId);
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

    // GET /api/costnorm/by-contract/{contractId}
    [HasPermission("CostNorm.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _costNormService.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/costnorm
    [HasPermission("CostNorm.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CostNormCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _costNormService.CreateAsync(dto, userId);
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

    // DELETE /api/costnorm/{id}
    [HasPermission("CostNorm.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _costNormService.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // ── Files ────────────────────────────────────────────────────────────────

    private const string EntityType = "costnorm";

    [HasPermission("CostNorm.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("CostNorm.Create")]
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

    [HasPermission("CostNorm.View")]
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

    [HasPermission("CostNorm.Delete")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);
        return StatusCode(result.StatusCode, result);
    }
}
