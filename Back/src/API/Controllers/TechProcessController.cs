using API.Authorization;
using Application.DTOs.TechProcesses;
using Application.Services;
using Core.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TechProcessController : ControllerBase
{
    private readonly ITechProcessService _techProcessService;

    public TechProcessController(ITechProcessService techProcessService)
    {
        _techProcessService = techProcessService;
    }

    // GET /api/techprocess
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] ProcessStatus? status = null)
    {
        var canView = User.HasClaim("perm", "TechProcess.View");
        var viewAll = User.HasClaim("perm", "TechProcess.ViewAll");

        if (!canView && !viewAll)
            return Forbid();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.GetAllAsync(userId, viewAll, status);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/techprocess/{id}
    [HasPermission("TechProcess.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _techProcessService.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/techprocess/by-contract/{contractId}
    [HasPermission("TechProcess.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _techProcessService.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/techprocess
    [HasPermission("TechProcess.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TechProcessCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TechProcessUpdateDto dto)
    {
        var result = await _techProcessService.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}/approve
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _techProcessService.ApproveAsync(id, userId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/techprocess/{id}/send-to-warehouse
    [HasPermission("TechProcess.Update")]
    [HttpPut("{id:guid}/send-to-warehouse")]
    public async Task<IActionResult> SendToWarehouse(Guid id)
    {
        var result = await _techProcessService.SendToWarehouseAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // DELETE /api/techprocess/{id}
    [HasPermission("TechProcess.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _techProcessService.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }

}
