using Application.DTOs.Roles;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RoleController : ControllerBase
{
    private readonly IRoleService _roleService;

    public RoleController(IRoleService roleService)
    {
        _roleService = roleService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _roleService.GetAllAsync();
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _roleService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RoleCreateDto dto)
    {
        var result = await _roleService.CreateAsync(dto);

        if (!result.Succeeded)
            return StatusCode(result.StatusCode, result);

        return StatusCode(result.StatusCode);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] RoleUpdateDto dto)
    {
        var result = await _roleService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return StatusCode(result.StatusCode, result);

        return StatusCode(result.StatusCode);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _roleService.DeleteAsync(id);

        if (!result.Succeeded)
            return StatusCode(result.StatusCode, result);

        return StatusCode(result.StatusCode);
    }
}
