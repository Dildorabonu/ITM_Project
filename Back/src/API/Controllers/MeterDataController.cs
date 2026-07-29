using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Hisoblagich o'lchovlarini o'qish (UI uchun). Ma'lumot bazaga
/// MeterPollerService (Modbus TCP) orqali yoziladi.
/// </summary>
[ApiController]
[Route("api/meter-data")]
[Authorize]
public class MeterDataController : ControllerBase
{
    private readonly IMeterDataService _service;

    public MeterDataController(IMeterDataService service)
    {
        _service = service;
    }

    /// <summary>Oxirgi o'lchovlar ro'yxati (ixtiyoriy ?device= filtri, ?take= limit).</summary>
    [HttpGet]
    public async Task<IActionResult> GetLatest([FromQuery] string? device, [FromQuery] int take = 100)
    {
        var result = await _service.GetLatestAsync(device, take);
        return Ok(result);
    }

    /// <summary>Ma'lumot kelgan qurilmalar nomlari.</summary>
    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices()
    {
        var result = await _service.GetDevicesAsync();
        return Ok(result);
    }
}
