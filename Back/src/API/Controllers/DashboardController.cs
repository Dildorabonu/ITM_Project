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

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly? trendFrom,
        [FromQuery] DateOnly? trendTo)
    {
        var result = await _service.GetSummaryAsync(trendFrom, trendTo);
        return StatusCode(result.StatusCode, result);
    }
}
