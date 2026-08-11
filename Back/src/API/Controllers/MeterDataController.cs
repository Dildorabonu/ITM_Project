using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Hisoblagich o'lchovlari va energiya paneli (UI uchun). Ma'lumot bazaga
/// MeterPollerService (Modbus TCP) orqali yoziladi.
/// </summary>
[ApiController]
[Route("api/meter-data")]
[Authorize]
public class MeterDataController : ControllerBase
{
    private readonly IMeterDataService _service;
    private readonly IEnergySummaryService _summaryService;

    public MeterDataController(IMeterDataService service, IEnergySummaryService summaryService)
    {
        _service = service;
        _summaryService = summaryService;
    }

    /// <summary>Oxirgi xom o'lchovlar ro'yxati (ixtiyoriy ?device= filtri, ?take= limit).</summary>
    [HttpGet]
    public async Task<IActionResult> GetLatest([FromQuery] string? device, [FromQuery] int take = 100)
    {
        var result = await _service.GetLatestAsync(device, take);
        return Ok(result);
    }

    /// <summary>Qurilmalar va ularning jonli holati (onlayn/oflayn, oxirgi quvvat).</summary>
    [HttpGet("devices")]
    public async Task<IActionResult> GetDevices()
    {
        var result = await _summaryService.GetDeviceStatusesAsync();
        return StatusCode(result.StatusCode, result);
    }

    /// <summary>Barcha qurilmalar bo'yicha energiya va xarajat paneli.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] string? period)
    {
        var result = await _summaryService.GetSummaryAsync(period);
        return StatusCode(result.StatusCode, result);
    }

    /// <summary>Bitta qurilmaning batafsil energiya ko'rsatkichlari.</summary>
    [HttpGet("summary/{device}")]
    public async Task<IActionResult> GetDeviceSummary(string device, [FromQuery] string? period)
    {
        var result = await _summaryService.GetDeviceDetailAsync(device, period);
        return StatusCode(result.StatusCode, result);
    }
}
