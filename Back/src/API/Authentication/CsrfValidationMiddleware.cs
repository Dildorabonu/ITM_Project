using Application.Options;
using Microsoft.Extensions.Options;

namespace API.Authentication;

/// <summary>
/// Double-Submit Cookie CSRF himoyasi. State-changing so'rovlarda (POST/PUT/PATCH/DELETE)
/// X-CSRF-Token header qiymati XSRF-TOKEN cookie qiymatiga teng bo'lishi kerak. Login va
/// refresh endpoint'lari istisno qilinadi — login'da cookie hali o'rnatilmagan, refresh'da
/// esa SameSite=Strict + httpOnly refresh_token cookie yetarli himoya beradi.
/// </summary>
public class CsrfValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly AuthCookieOptions _options;

    private static readonly string[] ExemptPaths =
    {
        "/api/auth/login",
        "/api/auth/refresh"
    };

    private static readonly string[] SafeMethods = { "GET", "HEAD", "OPTIONS", "TRACE" };

    public CsrfValidationMiddleware(RequestDelegate next, IOptions<AuthCookieOptions> options)
    {
        _next = next;
        _options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (ShouldValidate(context))
        {
            var headerToken = context.Request.Headers[_options.CsrfHeaderName].ToString();
            var cookieToken = context.Request.Cookies[_options.CsrfTokenName];

            if (string.IsNullOrEmpty(headerToken) || string.IsNullOrEmpty(cookieToken) ||
                !CryptographicEquals(headerToken, cookieToken))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    succeeded = false,
                    errors = new[] { "CSRF token missing or invalid." }
                });
                return;
            }
        }

        await _next(context);
    }

    private static bool ShouldValidate(HttpContext context)
    {
        if (SafeMethods.Contains(context.Request.Method, StringComparer.OrdinalIgnoreCase))
            return false;

        var path = context.Request.Path.Value ?? string.Empty;
        if (ExemptPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase)))
            return false;

        // Faqat API marshrutlarini tekshiramiz
        return path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++)
            diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
