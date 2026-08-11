using API.Authorization;
using Application.DTOs.Energy;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

/// <summary>
/// Elektr tariflari. O'qish — autentifikatsiyadan o'tgan hammaga (panelda narx
/// ko'rinishi kerak); o'zgartirish — faqat "Energy.Update" ruxsati bilan.
/// </summary>
[ApiController]
[Route("api/energy-tariffs")]
[Authorize]
public class EnergyTariffController : ControllerBase
{
    private readonly IEnergyTariffService _service;

    public EnergyTariffController(IEnergyTariffService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EnergyTariffSaveDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] EnergyTariffSaveDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
