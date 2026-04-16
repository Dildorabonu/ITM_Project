using API.Authorization;
using Application.DTOs.Materials;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MaterialController : ControllerBase
{
    private readonly IMaterialService _materialService;

    public MaterialController(IMaterialService materialService)
    {
        _materialService = materialService;
    }

    [HasPermission("WarehouseCheck.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category = null)
    {
        var result = await _materialService.GetAllAsync(category);
        return Ok(result);
    }

    [HasPermission("WarehouseCheck.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _materialService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MaterialCreateDto dto)
    {
        var result = await _materialService.CreateAsync(dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HttpPost("bulk")]
    public async Task<IActionResult> CreateBulk([FromBody] IEnumerable<MaterialCreateDto> dtos)
    {
        var result = await _materialService.CreateBulkAsync(dtos);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MaterialUpdateDto dto)
    {
        var result = await _materialService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _materialService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return StatusCode(result.Result, result);
    }

}
