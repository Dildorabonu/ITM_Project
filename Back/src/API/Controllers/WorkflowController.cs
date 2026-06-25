using System.Security.Claims;
using API.Authorization;
using Application.DTOs.Workflows;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkflowController : ControllerBase
{
    private readonly IWorkflowTemplateService _workflowTemplateService;

    public WorkflowController(IWorkflowTemplateService workflowTemplateService)
    {
        _workflowTemplateService = workflowTemplateService;
    }

    // Lookup for the contract-create form — any authenticated contract author may
    // read the active templates to choose one.
    [HttpGet("lookup")]
    public async Task<IActionResult> GetLookup()
    {
        var result = await _workflowTemplateService.GetAllAsync(isActive: true);
        return Ok(result);
    }

    [HasPermission("Workflows.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? isActive = null)
    {
        var result = await _workflowTemplateService.GetAllAsync(isActive);
        return Ok(result);
    }

    [HasPermission("Workflows.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _workflowTemplateService.GetByIdAsync(id);
        if (!result.Succeeded)
            return NotFound(result);
        return Ok(result);
    }

    [HasPermission("Workflows.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] WorkflowTemplateCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _workflowTemplateService.CreateAsync(dto, userId);
        if (!result.Succeeded)
            return BadRequest(result);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Workflows.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] WorkflowTemplateUpdateDto dto)
    {
        var result = await _workflowTemplateService.UpdateAsync(id, dto);
        if (!result.Succeeded)
            return BadRequest(result);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Workflows.Update")]
    [HttpPut("{id:guid}/default")]
    public async Task<IActionResult> SetDefault(Guid id)
    {
        var result = await _workflowTemplateService.SetDefaultAsync(id);
        if (!result.Succeeded)
            return BadRequest(result);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Workflows.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _workflowTemplateService.DeleteAsync(id);
        if (!result.Succeeded)
            return NotFound(result);
        return StatusCode(result.StatusCode, result);
    }
}
