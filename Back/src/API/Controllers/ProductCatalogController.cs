using API.Authorization;
using Application.DTOs.ProductCatalog;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

// Tayyor mahsulotlar katalogi.
// Ruxsatlar ikki maqsadga bo'lingan:
//   • /lookup va /quick — shartnoma yaratish oqimi uchun (Contracts.* bilan). Shartnoma yarata
//     oladigan foydalanuvchi katalogdan tanlashi va yangi mahsulot qo'shishi mumkin.
//   • qolgan CRUD — mustaqil boshqaruv sahifasi uchun (ProductCatalog.* moduli bilan).
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductCatalogController : ControllerBase
{
    private readonly IProductCatalogService _service;

    public ProductCatalogController(IProductCatalogService service)
    {
        _service = service;
    }

    // ─── Shartnoma formasi uchun (Contracts.*) ──────────────────────────────────

    [HasPermission("Contracts.View")]
    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var result = await _service.LookupAsync(page, pageSize, search);
        return Ok(result);
    }

    [HasPermission("Contracts.Create")]
    [HttpPost("quick")]
    public async Task<IActionResult> QuickCreate([FromBody] ProductCatalogCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.StatusCode, result);
    }

    // ─── Boshqaruv sahifasi uchun (ProductCatalog.*) ────────────────────────────

    [HasPermission("ProductCatalog.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var result = await _service.GetAllAsync(page, pageSize, search);
        return Ok(result);
    }

    [HasPermission("ProductCatalog.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductCatalogCreateDto dto)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        if (!result.Succeeded)
            return BadRequest(result);

        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("ProductCatalog.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductCatalogUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        if (!result.Succeeded)
            return StatusCode(result.StatusCode, result);

        return Ok(result);
    }

    [HasPermission("ProductCatalog.Delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        if (!result.Succeeded)
            return StatusCode(result.StatusCode, result);

        return Ok(result);
    }
}
