using API.Authorization;
using Application.DTOs;
using Application.DTOs.Products;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

// "Bo'lim omborlari" — bo'limlar kesimidagi ombor ko'rinishi. Korxona omborxonasi
// (ProductController) CRUD endpointlaridan ajratilgan, lekin bir xil Products.View
// huquqidan foydalanadi.
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentWarehouseController : ControllerBase
{
    private readonly IDepartmentWarehouseService _service;

    public DepartmentWarehouseController(IDepartmentWarehouseService service)
    {
        _service = service;
    }

    [HasPermission("Products.View")]
    [HttpGet("department-summaries")]
    public async Task<IActionResult> GetDepartmentSummaries()
    {
        if (!TryGetScope(out var restrict))
            return Ok(ApiResult<List<DepartmentWarehouseSummaryDto>>.Success([]));

        var result = await _service.GetDepartmentSummariesAsync(restrict);
        return Ok(result);
    }

    [HasPermission("Products.View")]
    [HttpGet("by-department/{departmentId:guid}")]
    public async Task<IActionResult> GetByDepartment(Guid departmentId)
    {
        if (!TryGetScope(out var restrict))
            return Forbid();

        if (restrict.HasValue && restrict.Value != departmentId)
            return Forbid();

        var result = await _service.GetByDepartmentAsync(departmentId);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    // ViewAll permissioni bo'lmagan foydalanuvchilar uchun JWT 'dept' claimidan
    // bo'lim ID sini beradi (restrict), ViewAll bor bo'lsa null — cheklov yo'q.
    // false qaytsa foydalanuvchi hech qanday bo'limga bog'lanmagan: bazaga
    // bormasdan darhol bo'sh/Forbid javob qaytariladi.
    private bool TryGetScope(out Guid? restrict)
    {
        restrict = null;

        if (User.HasClaim("perm", "Products.ViewAll"))
            return true;

        if (Guid.TryParse(User.FindFirstValue("dept"), out var deptId) && deptId != Guid.Empty)
        {
            restrict = deptId;
            return true;
        }

        return false;
    }
}
