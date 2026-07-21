using API.Authorization;
using Application.DTOs.Shipments;
using Application.Services;
using Core.Enums;
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

    // GET /api/shipmentbatch?contractId=...&contractProductId=...&kind=...
    [HasPermission("Shipments.View")]
    [HttpGet]
    public async Task<IActionResult> GetByContract(
        [FromQuery] Guid contractId,
        [FromQuery] Guid? contractProductId = null,
        [FromQuery] ShipmentBatchKind? kind = null)
    {
        var result = await _service.GetByContractAsync(contractId, contractProductId, kind);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/shipmentbatch/ready?contractId=...
    // Har bir mahsulot uchun mijozga topshirishga tayyor (ombordagi) miqdor.
    [HasPermission("Shipments.View")]
    [HttpGet("ready")]
    public async Task<IActionResult> GetReadyByContract([FromQuery] Guid contractId)
    {
        var result = await _service.GetReadyByContractAsync(contractId);
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

    // POST /api/shipmentbatch/pickup-auto
    // Umumiy miqdorni eng eski partiyadan boshlab avtomatik taqsimlab yozadi.
    [HasPermission("Shipments.Create")]
    [HttpPost("pickup-auto")]
    public async Task<IActionResult> CreatePickupAuto([FromBody] ShipmentPickupAutoCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreatePickupAutoAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }
}
