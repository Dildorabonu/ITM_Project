using API.Authorization;
using Application.DTOs.Requisitions;
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

    public RequisitionController(IRequisitionService requisitionService)
    {
        _requisitionService = requisitionService;
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

    /// <summary>Pending → Approved + QR kod generatsiya (Individual)</summary>
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

    /// <summary>Pending → Rejected</summary>
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

    /// <summary>Contract: Pending → SentToWarehouse | Individual: Approved → SentToWarehouse</summary>
    [HasPermission("Requisitions.SendToWarehouse")]
    [HttpPost("{id:guid}/send-to-warehouse")]
    public async Task<IActionResult> SendToWarehouse(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.SendToWarehouseAsync(id, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    [HasPermission("Requisitions.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _requisitionService.DeleteAsync(id, userId.Value);
        if (!result.Succeeded) return BadRequest(result);
        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
