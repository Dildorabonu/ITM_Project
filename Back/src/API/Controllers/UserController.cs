using API.Authorization;
using Application.DTOs.Users;
using Application.Helpers;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> GetLookup()
    {
        var result = await _userService.GetLookupAsync();
        return Ok(result);
    }

    [HasPermission("Users.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PaginationParams pagination)
    {
        var result = await _userService.GetAllAsync(pagination);
        return Ok(result);
    }

    [HasPermission("Users.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _userService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Users.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserCreateDto dto)
    {
        var result = await _userService.CreateAsync(dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Users.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UserUpdateDto dto)
    {
        var result = await _userService.UpdateAsync(id, dto);
        return StatusCode(result.Succeeded ? result.Result : result.StatusCode, result);
    }

    [HasPermission("Users.Delete")]
    [HttpPatch("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id)
    {
        var result = await _userService.UpdateAsync(id, new Application.DTOs.Users.UserUpdateDto { IsActive = false });
        return StatusCode(result.Succeeded ? result.Result : result.StatusCode, result);
    }

    [HasPermission("Users.Update")]
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id)
    {
        var result = await _userService.UpdateAsync(id, new Application.DTOs.Users.UserUpdateDto { IsActive = true });
        return StatusCode(result.Succeeded ? result.Result : result.StatusCode, result);
    }
}
