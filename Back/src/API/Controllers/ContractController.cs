using API.Authorization;
using Application.DTOs.Contracts;
using Application.Services;
using Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContractController : ControllerBase
{
    private readonly IContractService _contractService;

    public ContractController(IContractService contractService)
    {
        _contractService = contractService;
    }

    [HasPermission("Contracts.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] ContractStatus? status = null,
        [FromQuery] Guid? departmentId = null)
    {
        var result = await _contractService.GetAllAsync(status, departmentId);
        return Ok(result);
    }

    [HasPermission("Contracts.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _contractService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ContractCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _contractService.CreateAsync(dto, userId);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ContractUpdateDto dto)
    {
        var result = await _contractService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return result.StatusCode == 404 ? NotFound(result) : BadRequest(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Update")]
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] ContractStatusUpdateDto dto)
    {
        var result = await _contractService.UpdateStatusAsync(id, dto.Status);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Contracts.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _contractService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }
}
