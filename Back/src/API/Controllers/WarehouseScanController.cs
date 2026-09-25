using API.Authorization;
using Application.DTOs.Scan;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

// Ombor skaneri (HID keyboard-wedge) endpointlari. CRUD ProductController da qoladi.
// Eslatma: mavjud `ScanController` WIA hujjat skaneri uchun — bu boshqa, ombor QR oqimi.
[ApiController]
[Route("api/warehouse-scan")]
[Authorize]
public class WarehouseScanController : ControllerBase
{
    private readonly IScanService _scanService;

    public WarehouseScanController(IScanService scanService)
    {
        _scanService = scanService;
    }

    // QR kod bo'yicha Product kartasi + Material agregati + so'nggi harakatlar.
    [HasPermission("Products.View")]
    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string code)
    {
        var result = await _scanService.LookupAsync(code ?? string.Empty);
        if (!result.Succeeded) return StatusCode(result.StatusCode, result);
        return Ok(result);
    }

    // 58mm termal yorliq uchun minimal ma'lumot.
    [HasPermission("Products.View")]
    [HttpGet("{id:guid}/label")]
    public async Task<IActionResult> Label(Guid id)
    {
        var result = await _scanService.GetLabelAsync(id);
        if (!result.Succeeded) return StatusCode(result.StatusCode, result);
        return Ok(result);
    }

    // Chiqim / Tuzatish amali → yangilangan lookup.
    [HasPermission("Products.Update")]
    [HttpPost("action")]
    public async Task<IActionResult> Action([FromBody] ScanActionDto dto)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _scanService.ActionAsync(dto, userId.Value);
        if (!result.Succeeded) return StatusCode(result.StatusCode, result);
        return Ok(result);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}