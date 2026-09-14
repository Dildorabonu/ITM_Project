using Application.Licensing;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

public record ActivateLicenseRequest(string Token, string Secret);

[ApiController]
[Route("api/license")]
[AllowAnonymous]
public class LicenseController : ControllerBase
{
    private readonly LicenseGuard _guard;
    private readonly ILicenseService _licenseService;

    public LicenseController(LicenseGuard guard, ILicenseService licenseService)
    {
        _guard = guard;
        _licenseService = licenseService;
    }

    // Deploy paytida shu serverning "barmoq izi"ni olish uchun. Litsenziyani aynan
    // shu qiymatga bog'lab imzolaymiz (LicenseGen sign --machine <fingerprint>).
    // Sirli emas — bilib olish tokenni soxtalashtirishga yordam bermaydi.
    [HttpGet("fingerprint")]
    public IActionResult Fingerprint()
    {
        return Ok(new { result = new { fingerprint = MachineFingerprint.Get() } });
    }

    // Ochiq endpoint — litsenziya bloklaganda ham ishlaydi. Frontend blok ekranini
    // shu ma'lumot bilan to'ldiradi.
    [HttpGet("status")]
    public IActionResult Status()
    {
        return Ok(new { result = Project(_guard.Status) });
    }

    // Admin panel/blok ekrandan yangi tokenni faollashtirish. Superadmin paroli talab qilinadi.
    // Bloklangan holatda ham ishlaydi (middleware /api/license'ni o'tkazadi, JWT shart emas).
    [HttpPost("activate")]
    public async Task<IActionResult> Activate([FromBody] ActivateLicenseRequest req)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.Secret))
            return BadRequest(new { succeeded = false, errors = new[] { "Token va parol majburiy." } });

        var result = await _licenseService.ActivateAsync(req.Token, req.Secret);
        if (!result.Success)
            return BadRequest(new { succeeded = false, errors = new[] { result.Error } });

        return Ok(new { result = Project(result.Status!) });
    }

    // Frontend (LicenseGate + /litsenziya) faqat shu maydonlarni o'qiydi.
    private static object Project(LicenseStatus s) => new
    {
        valid = s.Valid,
        reason = s.Reason,
        message = s.Message,
        customer = s.Customer,
        expiresUtc = s.ExpiresUtc,
    };
}
