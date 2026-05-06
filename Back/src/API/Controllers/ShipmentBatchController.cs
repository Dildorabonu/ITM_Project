using API.Authorization;
using Application.DTOs.Shipments;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ShipmentBatchController : ControllerBase
{
    private readonly IShipmentBatchService _service;

    public ShipmentBatchController(IShipmentBatchService service)
    {
        _service = service;
    }

    // GET /api/shipmentbatch?contractId=...&contractProductId=...
    [HasPermission("Shipments.View")]
    [HttpGet]
    public async Task<IActionResult> GetByContract(
        [FromQuery] Guid contractId,
        [FromQuery] Guid? contractProductId = null)
    {
        var result = await _service.GetByContractAsync(contractId, contractProductId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/shipmentbatch
    [HasPermission("Shipments.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ShipmentBatchCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    // DELETE /api/shipmentbatch/{id}
    [HasPermission("Shipments.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
