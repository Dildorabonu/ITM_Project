using API.Authorization;
using Application.DTOs.Products;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductController(IProductService productService)
    {
        _productService = productService;
    }

    [HasPermission("Products.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] Guid? departmentId = null)
    {
        var restrict = GetRestrictDepartmentId();
        var result = await _productService.GetAllAsync(page, pageSize, search, departmentId, restrict);
        return Ok(result);
    }

    [HasPermission("Products.View")]
    [HttpGet("by-department/{departmentId:guid}")]
    public async Task<IActionResult> GetByDepartment(Guid departmentId)
    {
        var restrict = GetRestrictDepartmentId();
        if (restrict.HasValue && restrict.Value != departmentId)
            return Forbid();

        var result = await _productService.GetByDepartmentAsync(departmentId);
        return Ok(result);
    }

    [HasPermission("Products.View")]
    [HttpGet("department-summaries")]
    public async Task<IActionResult> GetDepartmentSummaries()
    {
        var restrict = GetRestrictDepartmentId();
        var result = await _productService.GetDepartmentSummariesAsync(restrict);
        return Ok(result);
    }

    [HasPermission("Products.View")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _productService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HasPermission("Products.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductCreateDto dto)
    {
        var result = await _productService.CreateAsync(dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Products.Create")]
    [HttpPost("bulk")]
    public async Task<IActionResult> CreateBulk([FromBody] IEnumerable<ProductCreateDto> dtos)
    {
        var result = await _productService.CreateBulkAsync(dtos);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Products.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductUpdateDto dto)
    {
        var result = await _productService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HasPermission("Products.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _productService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return StatusCode(result.Result, result);
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
