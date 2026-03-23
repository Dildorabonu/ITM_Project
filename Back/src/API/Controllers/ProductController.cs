using Application.DTOs.Products;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _productService.GetAllAsync();
        return Ok(result);
    }

    [HttpGet("by-department/{departmentId:guid}")]
    public async Task<IActionResult> GetByDepartment(Guid departmentId)
    {
        var result = await _productService.GetByDepartmentAsync(departmentId);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _productService.GetByIdAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductCreateDto dto)
    {
        var result = await _productService.CreateAsync(dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductUpdateDto dto)
    {
        var result = await _productService.UpdateAsync(id, dto);

        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.Result, result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _productService.DeleteAsync(id);

        if (!result.Succeeded)
            return NotFound(result);

        return StatusCode(result.Result, result);
    }
}
