using Application.Licensing;

namespace Application.Services;

public interface ILicenseService
{
    /// <summary>
    /// Tokenni tekshiradi, yuqori suv belgisini (high-water mark) yangilaydi,
    /// buzishni aniqlaydi va joriy holatni LicenseGuard'ga yozib qaytaradi.
    /// </summary>
    Task<LicenseStatus> RefreshAsync(CancellationToken ct = default);

    /// <summary>
    /// Admin panel orqali yangi tokenni faollashtiradi. Superadmin paroli bilan
    /// himoyalangan (bloklangan holatda ham ishlaydi, JWT shart emas). Muvaffaqiyatli
    /// bo'lsa token bazaga saqlanadi va holat qayta hisoblanadi.
    /// </summary>
    Task<LicenseActivationResult> ActivateAsync(string token, string secret, CancellationToken ct = default);
}

public sealed class LicenseActivationResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public LicenseStatus? Status { get; init; }
}
