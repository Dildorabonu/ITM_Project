using API.Authorization;
using Application.DTOs.Departments;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentController : ControllerBase
{
    private readonly IDepartmentService _departmentService;

    public DepartmentController(IDepartmentService departmentService)
    {
        _departmentService = departmentService;
    }

    [HasPermission("Departments.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _departmentService.GetAllAsync();
        return Ok(result);
    }

    [HasPermission("Departments.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _departmentService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Departments.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DepartmentCreateDto dto)
    {
        var result = await _departmentService.CreateAsync(dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Departments.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DepartmentUpdateDto dto)
    {
        var result = await _departmentService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Departments.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _departmentService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return StatusCode(result.Result, result);
    }
}
