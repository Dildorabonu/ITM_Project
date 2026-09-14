using API.Authorization;
using Application.DTOs.ProductCatalog;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

// Tayyor mahsulotlar katalogi.
// Ruxsatlar ikki maqsadga bo'lingan:
//   • /lookup — shartnoma yaratish oqimi uchun (Contracts.View bilan): katalogdan tanlash.
//     Yangi mahsulot shu yerda emas, katalog sahifasida qo'shiladi (ProductCatalog.Create).
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

    // Shartnoma formasidagi tanlash ro'yxati — yengil javob (Id/Nom/Kod/O'lchov).
    [HasPermission("Contracts.View")]
    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
        => Ok(await _service.LookupAsync(page, pageSize, search));

    [HasPermission("ProductCatalog.View")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] bool archived = false)
        => Ok(await _service.GetAllAsync(page, pageSize, search, archived));

    [HasPermission("ProductCatalog.View")]
    [HttpGet("{id:guid}/details")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetDetailAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("ProductCatalog.Create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductCatalogCreateDto dto)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        var result = await _service.CreateAsync(dto, userId);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("ProductCatalog.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductCatalogUpdateDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("ProductCatalog.Delete")]
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var result = await _service.ArchiveAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("ProductCatalog.Delete")]
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        var result = await _service.RestoreAsync(id);
        return StatusCode(result.StatusCode, result);
    }
}
