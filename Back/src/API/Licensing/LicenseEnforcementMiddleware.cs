using Application.Licensing;

namespace API.Licensing;

/// <summary>
/// Litsenziya yaroqsiz/muddati tugagan bo'lsa barcha /api so'rovlarni 403 bilan bloklaydi.
/// Faqat /api/license/* ochiq qoladi — frontend holatni o'qib, blok ekranini ko'rsatishi uchun.
/// Login ham /api ostida bo'lgani uchun to'liq blok ta'minlanadi.
/// </summary>
public class LicenseEnforcementMiddleware
{
    private readonly RequestDelegate _next;
    private readonly LicenseGuard _guard;

    public LicenseEnforcementMiddleware(RequestDelegate next, LicenseGuard guard)
    {
        _next = next;
        _guard = guard;
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        var path = ctx.Request.Path;

        if (path.StartsWithSegments("/api") && !path.StartsWithSegments("/api/license"))
        {
            var status = _guard.Status;
            if (!status.Valid)
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                ctx.Response.Headers["X-License-Status"] = status.Reason;
                await ctx.Response.WriteAsJsonAsync(new
                {
                    succeeded = false,
                    statusCode = 403,
                    licenseExpired = true,
                    reason = status.Reason,
                    errors = new[] { status.Message },
                });
                return;
            }
        }

        await _next(ctx);
    }
}
