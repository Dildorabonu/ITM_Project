using API.Authorization;
using Application.DTOs.StockMovements;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/stock-movements")]
[Authorize]
public class StockMovementController : ControllerBase
{
    private readonly IStockMovementService _stockMovementService;

    public StockMovementController(IStockMovementService stockMovementService)
    {
        _stockMovementService = stockMovementService;
    }

    /// <summary>Ombor harakatlari jurnali (read-only). Barcha filtrlar query param, CreatedAt DESC, sahifalangan.</summary>
    [HasPermission("WarehouseCheck.View")]
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] StockMovementFilter filter)
    {
        var result = await _stockMovementService.GetAsync(filter);
        return Ok(result);
    }

    /// <summary>Filtr tugmachalari uchun harakatlar soni — tur kesimida. Type filtridan qat'i nazar hisoblanadi.</summary>
    [HasPermission("WarehouseCheck.View")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] StockMovementFilter filter)
    {
        var result = await _stockMovementService.GetSummaryAsync(filter);
        return Ok(result);
    }
}
