using Microsoft.AspNetCore.Http;

namespace Application.Options;

public class AuthCookieOptions
{
    public const string SectionName = "AuthCookies";

    public string AccessTokenName { get; set; } = "access_token";
    public string RefreshTokenName { get; set; } = "refresh_token";
    public string CsrfTokenName { get; set; } = "XSRF-TOKEN";
    public string CsrfHeaderName { get; set; } = "X-CSRF-Token";

    public string? Domain { get; set; }

    /// <summary>
    /// Controls the <c>Secure</c> attribute on auth cookies.
    /// <list type="bullet">
    /// <item><see cref="CookieSecurePolicy.SameAsRequest"/> (default) — Secure is set only when the
    /// request itself arrived over HTTPS. This keeps cookies working on an internal HTTP LAN
    /// deployment while still hardening them whenever TLS is in front.</item>
    /// <item><see cref="CookieSecurePolicy.Always"/> — always set Secure (require HTTPS).</item>
    /// <item><see cref="CookieSecurePolicy.None"/> — never set Secure.</item>
    /// </list>
    /// </summary>
    public CookieSecurePolicy SecurePolicy { get; set; } = CookieSecurePolicy.SameAsRequest;

    public SameSiteMode SameSite { get; set; } = SameSiteMode.Strict;

    public string RefreshTokenPath { get; set; } = "/api/auth";
}
