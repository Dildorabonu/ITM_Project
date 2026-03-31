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

    // GET /api/contracttask/by-contract/{contractId}
    [HasPermission("Tasks.View")]
    [HttpGet("by-contract/{contractId:guid}")]
    public async Task<IActionResult> GetByContract(Guid contractId)
    {
        var result = await _service.GetByContractIdAsync(contractId);
        return StatusCode(result.StatusCode, result);
    }

    // GET /api/contracttask/{id}
    [HasPermission("Tasks.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/contracttask
    [HasPermission("Tasks.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ContractTaskCreateDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    // POST /api/contracttask/bulk
    [HasPermission("Tasks.Create")]
    [HttpPost("bulk")]
    public async Task<IActionResult> CreateBulk([FromBody] IEnumerable<ContractTaskCreateDto> dtos)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _service.CreateBulkAsync(dtos, userId);
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
}
