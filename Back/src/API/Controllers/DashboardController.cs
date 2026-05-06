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

    // GET /api/dashboard/summary?trendDays=30
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int trendDays = 30)
    {
        var result = await _service.GetSummaryAsync(trendDays);
        return StatusCode(result.StatusCode, result);
    }
}
