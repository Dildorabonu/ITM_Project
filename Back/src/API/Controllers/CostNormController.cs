using API.Authorization;
using Application.DTOs.CostNorms;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CostNormController : ControllerBase
{
    private readonly ICostNormService _costNormService;

    public CostNormController(ICostNormService costNormService)
    {
        _costNormService = costNormService;
    }

    // GET /api/costnorm
    [HasPermission("CostNorm.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? contractId = null)
    {
        var result = await _costNormService.GetAllAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/costnorm/{id}
    [HasPermission("CostNorm.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _costNormService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/costnorm/by-contract/{contractId}
    [HasPermission("CostNorm.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _costNormService.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/costnorm
    [HasPermission("CostNorm.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CostNormCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _costNormService.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/costnorm/{id}
    [HasPermission("CostNorm.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CostNormUpdateDto dto)
    {
        var result = await _costNormService.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    // DELETE /api/costnorm/{id}
    [HasPermission("CostNorm.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _costNormService.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
