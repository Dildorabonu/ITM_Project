namespace Application.Licensing;

public sealed class LicenseStatus
{
    public bool Valid { get; init; }
    public string? Customer { get; init; }
    public DateTime? ExpiresUtc { get; init; }

    // Mashina o'qiy oladigan kod: OK | NO_KEY | INVALID | EXPIRED | TAMPER
    public string Reason { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

/// <summary>
/// Joriy litsenziya holatini xotirada ushlab turuvchi singleton — har so'rovda
/// bazaga bormasdan middleware tez o'qishi uchun. Fon xizmati (LicenseRefreshService)
/// har daqiqada yangilab turadi.
/// </summary>
public sealed class LicenseGuard
{
    private volatile LicenseStatus _status = new()
    {
        Valid = false,
        Reason = "NO_KEY",
        Message = "Litsenziya hali tekshirilmadi",
    };

    public LicenseStatus Status
    {
        get => _status;
        set => _status = value;
    }
}
