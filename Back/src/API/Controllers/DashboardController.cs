using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _service;

    public DashboardController(IDashboardService service)
    {
        _service = service;
    }

    // GET /api/dashboard/summary?from=2026-05-01&to=2026-05-06
    // If from/to omitted → defaults to current month (1st of month → today).
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null)
    {
        var result = await _service.GetSummaryAsync(from, to);
        return StatusCode(result.StatusCode, result);
    }
}
