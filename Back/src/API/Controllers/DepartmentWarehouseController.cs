using API.Authorization;
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
        var restrict = GetRestrictDepartmentId();
        var result = await _service.GetDepartmentSummariesAsync(restrict);
        return Ok(result);
    }

    [HasPermission("Products.View")]
    [HttpGet("by-department/{departmentId:guid}")]
    public async Task<IActionResult> GetByDepartment(Guid departmentId)
    {
        var restrict = GetRestrictDepartmentId();
        if (restrict.HasValue && restrict.Value != departmentId)
            return Forbid();

        var result = await _service.GetByDepartmentAsync(departmentId);
        return Ok(result);
    }

    // ViewAll permissioni bo'lmagan foydalanuvchilar uchun JWT 'dept' claimidan
    // bo'lim ID sini qaytaradi. ViewAll bor bo'lsa null — cheklov yo'q.
    private Guid? GetRestrictDepartmentId()
    {
        if (User.HasClaim("perm", "Products.ViewAll"))
            return null;

        var deptClaim = User.FindFirstValue("dept");
        if (Guid.TryParse(deptClaim, out var deptId))
            return deptId;

        // Bo'limga bog'lanmagan va ViewAll yo'q — hech narsa ko'rmaydi
        return Guid.Empty;
    }
}
