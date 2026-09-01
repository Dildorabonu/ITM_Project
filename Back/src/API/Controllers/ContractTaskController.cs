using API.Authorization;
using Application.DTOs.ContractTasks;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContractTaskController : ControllerBase
{
    private readonly IContractTaskService _service;

    public ContractTaskController(IContractTaskService service)
    {
        _service = service;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/contracttask/by-contract/{contractId}
    [HasPermission("Tasks.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _service.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/contracttask/bulk
    [HasPermission("Tasks.Create")]
    [HttpPost("bulk")]
    public async Task<IActionResult> CreateBulk([FromBody] IEnumerable<ContractTaskCreateDto> dtos)
    {
        var result = await _service.CreateBulkAsync(dtos, CurrentUserId);
        return StatusCode(result.StatusCode, result);
    }

    // PUT /api/contracttask/{id}
    [HasPermission("Tasks.Create")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ContractTaskUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    // DELETE /api/contracttask/{id}
    [HasPermission("Tasks.Create")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/contracttask/{id}/log
    [HasPermission("Tasks.Create")]
    [HttpPost("{id:guid}/log")]
    public async Task<IActionResult> LogProgress(Guid id, [FromBody] ContractTaskLogCreateDto dto)
    {
        var result = await _service.LogProgressAsync(id, dto, CurrentUserId);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/contracttask/{id}/logs
    [HasPermission("Tasks.View")]
    [HttpGet("{id:guid}/logs")]
    public async Task<IActionResult> GetLogs(Guid id)
    {
        var result = await _service.GetLogsAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
