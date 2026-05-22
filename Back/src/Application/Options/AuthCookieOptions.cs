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
    public bool Secure { get; set; } = true;
    public SameSiteMode SameSite { get; set; } = SameSiteMode.Strict;

    public string RefreshTokenPath { get; set; } = "/api/auth";
}
