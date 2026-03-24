using API.Authorization;
using Application.DTOs.Contracts;
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

    [HasPermission("Contracts.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] ContractStatus? status = null,
        [FromQuery] Guid? departmentId = null)
    {
        var result = await _contractService.GetAllAsync(status, departmentId);
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
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
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
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] ContractStatusUpdateDto dto)
    {
        var result = await _contractService.UpdateStatusAsync(id, dto.Status);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _contractService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
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

    [HasPermission("Contracts.Update")]
    [HttpPost("{id:guid}/users")]
    public async Task<IActionResult> AssignUsers(Guid id, [FromBody] AssignContractUsersDto dto)
    {
        var result = await _contractService.AssignUsersAsync(id, dto.UserIds);

        if (!result.Succeeded)
            return result.StatusCode == 404 ? NotFound(result) : BadRequest(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Update")]
    [HttpDelete("{id:guid}/users/{userId:guid}")]
    public async Task<IActionResult> RemoveUser(Guid id, Guid userId)
    {
        var result = await _contractService.RemoveUserAsync(id, userId);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    // ── Files ────────────────────────────────────────────────────────────────

    private const string EntityType = "contracts";

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetFiles(Guid id)
    {
        var result = await _attachmentService.GetAllAsync(EntityType, id);
        return Ok(result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPost("{id:guid}/files")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
    public async Task<IActionResult> UploadFile(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Fayl tanlanmagan.");

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        await using var stream = file.OpenReadStream();
        var result = await _attachmentService.UploadAsync(
            EntityType, id,
            stream, file.FileName, file.ContentType, file.Length,
            userId);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(201, result);
    }

    [HasPermission("Contracts.View")]
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

    [HasPermission("Contracts.Update")]
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> DeleteFile(Guid id, Guid fileId)
    {
        var result = await _attachmentService.DeleteAsync(EntityType, id, fileId);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }
}
