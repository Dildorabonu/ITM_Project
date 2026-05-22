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
        response.Cookies.Append(_options.AccessTokenName, accessToken, BuildAccessOptions(accessExpiresAt));
        response.Cookies.Append(_options.RefreshTokenName, refreshToken, BuildRefreshOptions(refreshExpiresAt));
        WriteCsrfCookie(response, refreshExpiresAt);
    }

    public void WriteCsrfCookie(HttpResponse response, DateTime expiresAt)
    {
        // CSRF token cookie — readable by JS so frontend can mirror it in X-CSRF-Token header
        // (Double-Submit Cookie pattern). Not HttpOnly by design.
        response.Cookies.Append(_options.CsrfTokenName, GenerateCsrfToken(), new CookieOptions
        {
            HttpOnly = false,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            Path = "/",
            Domain = _options.Domain,
            Expires = expiresAt
        });
    }

    public void ClearAuthCookies(HttpResponse response)
    {
        // Match Path/Domain to ensure browser deletes the cookies
        response.Cookies.Delete(_options.AccessTokenName, new CookieOptions
        {
            Path = "/",
            Domain = _options.Domain,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            HttpOnly = true
        });
        response.Cookies.Delete(_options.RefreshTokenName, new CookieOptions
        {
            Path = _options.RefreshTokenPath,
            Domain = _options.Domain,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            HttpOnly = true
        });
        response.Cookies.Delete(_options.CsrfTokenName, new CookieOptions
        {
            Path = "/",
            Domain = _options.Domain,
            Secure = _options.Secure,
            SameSite = _options.SameSite,
            HttpOnly = false
        });
    }

    public string GenerateCsrfToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes);
    }

    private CookieOptions BuildAccessOptions(DateTime expiresAt) => new()
    {
        HttpOnly = true,
        Secure = _options.Secure,
        SameSite = _options.SameSite,
        Path = "/",
        Domain = _options.Domain,
        Expires = expiresAt
    };

    private CookieOptions BuildRefreshOptions(DateTime expiresAt) => new()
    {
        HttpOnly = true,
        Secure = _options.Secure,
        SameSite = _options.SameSite,
        Path = _options.RefreshTokenPath,
        Domain = _options.Domain,
        Expires = expiresAt
    };
}
