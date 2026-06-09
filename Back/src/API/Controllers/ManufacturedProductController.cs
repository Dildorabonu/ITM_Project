using API.Authorization;
using Application.DTOs.ManufacturedProducts;
using Application.Services;
using Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ManufacturedProductController : ControllerBase
{
    private readonly IManufacturedProductService _service;

    public ManufacturedProductController(IManufacturedProductService service)
    {
        _service = service;
    }

    [HasPermission("ManufacturedProducts.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] ManufacturingStatus? status = null)
    {
        var result = await _service.GetAllAsync(page, pageSize, search, departmentId, status);
        return Ok(result);
    }

    [HasPermission("ManufacturedProducts.View")]
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var result = await _service.GetStatsAsync();
        return Ok(result);
    }

    [HasPermission("ManufacturedProducts.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ManufacturedProductCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("ManufacturedProducts.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ManufacturedProductUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("ManufacturedProducts.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return StatusCode(result.Result, result);
    }
}
