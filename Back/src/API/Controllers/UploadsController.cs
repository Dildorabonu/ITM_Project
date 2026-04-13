using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadsController : ControllerBase
{
    private static readonly string[] AllowedImageTypes =
        ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private readonly IFileStorageService _storage;

    public UploadsController(IFileStorageService storage)
    {
        _storage = storage;
    }

    /// <summary>Talabnoma qatori uchun rasm yuklash. Nisbiy URL qaytaradi.</summary>
    [HttpPost("req-item-photo")]
    [RequestSizeLimit(MaxFileSizeBytes)]
    public async Task<IActionResult> UploadReqItemPhoto(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Fayl tanlanmagan.");

        if (file.Length > MaxFileSizeBytes)
            return BadRequest("Fayl hajmi 5 MB dan oshmasligi kerak.");

        if (!AllowedImageTypes.Contains(file.ContentType.ToLowerInvariant()))
            return BadRequest("Faqat JPEG, PNG yoki WebP formatlar qabul qilinadi.");

        var url = await _storage.SaveAsync(file, "req-items");
        return Ok(new { url });
    }
}
