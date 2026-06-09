using System.Security.Cryptography;
using Application.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace API.Authentication;

public interface IAuthCookieWriter
{
    void WriteAuthCookies(HttpResponse response, string accessToken, DateTime accessExpiresAt,
                         string refreshToken, DateTime refreshExpiresAt);
    void WriteCsrfCookie(HttpResponse response, DateTime expiresAt);
    void ClearAuthCookies(HttpResponse response);
    string GenerateCsrfToken();
}

public class AuthCookieWriter : IAuthCookieWriter
{
    private readonly AuthCookieOptions _options;

    public AuthCookieWriter(IOptions<AuthCookieOptions> options)
    {
        _options = options.Value;
    }

    public void WriteAuthCookies(HttpResponse response, string accessToken, DateTime accessExpiresAt,
                                 string refreshToken, DateTime refreshExpiresAt)
    {
        var secure = ResolveSecure(response);
        response.Cookies.Append(_options.AccessTokenName, accessToken, BuildAccessOptions(accessExpiresAt, secure));
        response.Cookies.Append(_options.RefreshTokenName, refreshToken, BuildRefreshOptions(refreshExpiresAt, secure));
        WriteCsrfCookie(response, refreshExpiresAt);
    }

    public void WriteCsrfCookie(HttpResponse response, DateTime expiresAt)
    {
        // CSRF token cookie — readable by JS so frontend can mirror it in X-CSRF-Token header
        // (Double-Submit Cookie pattern). Not HttpOnly by design.
        response.Cookies.Append(_options.CsrfTokenName, GenerateCsrfToken(), new CookieOptions
        {
            HttpOnly = false,
            Secure = ResolveSecure(response),
            SameSite = _options.SameSite,
            Path = "/",
            Domain = _options.Domain,
            Expires = expiresAt
        });
    }

    public void ClearAuthCookies(HttpResponse response)
    {
        var secure = ResolveSecure(response);
        // Match Path/Domain to ensure browser deletes the cookies
        response.Cookies.Delete(_options.AccessTokenName, new CookieOptions
        {
            Path = "/",
            Domain = _options.Domain,
            Secure = secure,
            SameSite = _options.SameSite,
            HttpOnly = true
        });
        response.Cookies.Delete(_options.RefreshTokenName, new CookieOptions
        {
            Path = _options.RefreshTokenPath,
            Domain = _options.Domain,
            Secure = secure,
            SameSite = _options.SameSite,
            HttpOnly = true
        });
        response.Cookies.Delete(_options.CsrfTokenName, new CookieOptions
        {
            Path = "/",
            Domain = _options.Domain,
            Secure = secure,
            SameSite = _options.SameSite,
            HttpOnly = false
        });
    }

    public string GenerateCsrfToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes);
    }

    // The Secure flag is computed per-request so the same binary works on an internal
    // HTTP LAN (Secure omitted → browser persists the cookie) and behind HTTPS
    // (Secure set → cookie only travels over TLS). Behaviour is configurable via SecurePolicy.
    private bool ResolveSecure(HttpResponse response) => _options.SecurePolicy switch
    {
        CookieSecurePolicy.Always => true,
        CookieSecurePolicy.None => false,
        _ => response.HttpContext.Request.IsHttps,
    };

    private CookieOptions BuildAccessOptions(DateTime expiresAt, bool secure) => new()
    {
        HttpOnly = true,
        Secure = secure,
        SameSite = _options.SameSite,
        Path = "/",
        Domain = _options.Domain,
        Expires = expiresAt
    };

    private CookieOptions BuildRefreshOptions(DateTime expiresAt, bool secure) => new()
    {
        HttpOnly = true,
        Secure = secure,
        SameSite = _options.SameSite,
        Path = _options.RefreshTokenPath,
        Domain = _options.Domain,
        Expires = expiresAt
    };
}
