using API.Authorization;
using Application.DTOs.Requisitions;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

/// <summary>
/// Talabnoma zaxira foizi. O'qish — hammaga (talabnoma to'ldiruvchi joriy foizni
/// ko'radi); o'zgartirish — faqat "RequisitionAllowance.Update" ruxsati bilan.
/// </summary>
[ApiController]
[Route("api/requisition-allowance")]
[Authorize]
public class RequisitionAllowanceController : ControllerBase
{
    private readonly IRequisitionAllowanceService _service;

    public RequisitionAllowanceController(IRequisitionAllowanceService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("RequisitionAllowance.Update")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RequisitionAllowanceSaveDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }
}
