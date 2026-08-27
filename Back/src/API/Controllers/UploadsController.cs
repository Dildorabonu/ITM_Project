using System.Collections.Frozen;
using API.Authorization;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadsController : ControllerBase
{
    // FrozenSet + OrdinalIgnoreCase — har so'rovda ContentType'ni kichik harfga
    // o'tkazib yangi string yaratish shart emas.
    private static readonly FrozenSet<string> AllowedImageTypes =
        new[] { "image/jpeg", "image/jpg", "image/png", "image/webp" }
            .ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    // multipart boundary + header'lar ham so'rov tanasiga kiradi. Agar so'rov
    // limiti aynan 5 MB bo'lsa, 5 MB li fayl Kestrel darajasida 413 bilan
    // uziladi va pastdagi tushunarli 400 xabari hech qachon ko'rinmaydi.
    private const long MaxRequestSizeBytes = MaxFileSizeBytes + 16 * 1024;

    private readonly IFileStorageService _storage;

    public UploadsController(IFileStorageService storage)
    {
        _storage = storage;
    }

    /// <summary>Talabnoma qatori uchun rasm yuklash. Nisbiy URL qaytaradi.</summary>
    /// <remarks>
    /// Rasm faqat talabnoma yaratish oqimida yuklanadi va darhol keyin
    /// POST /api/requisition chaqiriladi — u ham aynan shu ruxsatni talab qiladi.
    /// Ruxsatsiz foydalanuvchi ilgari rasmni yuklab ulgurardi, keyin create 403
    /// qaytarardi va fayl diskda egasiz qolardi.
    /// </remarks>
    [HasPermission("Requisitions.Create")]
    [HttpPost("req-item-photo")]
    [RequestSizeLimit(MaxRequestSizeBytes)]
    public async Task<IActionResult> UploadReqItemPhoto(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Fayl tanlanmagan.");

        if (file.Length > MaxFileSizeBytes)
            return BadRequest("Fayl hajmi 5 MB dan oshmasligi kerak.");

        // ContentType multipart qismida umuman bo'lmasligi mumkin — null bo'lsa
        // ham 400 qaytaramiz (ilgari bu yerda NullReferenceException → 500 edi).
        if (file.ContentType is null || !AllowedImageTypes.Contains(file.ContentType))
            return BadRequest("Faqat JPEG, PNG yoki WebP formatlar qabul qilinadi.");

        var url = await _storage.SaveAsync(file, "req-items");
        return Ok(new { url });
    }
}
