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

    public Task InvokeAsync(HttpContext ctx)
    {
        // Odatiy holat: litsenziya faol — bitta xotira o'qishdan keyin darhol o'tkazamiz
        // (path solishtirish ham, async state machine ham keraksiz).
        var status = _guard.Status;
        if (status.Valid) return _next(ctx);

        var path = ctx.Request.Path;
        if (!path.StartsWithSegments("/api") || path.StartsWithSegments("/api/license"))
            return _next(ctx);

        return BlockAsync(ctx, status);
    }

    private static Task BlockAsync(HttpContext ctx, LicenseStatus status)
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        ctx.Response.Headers["X-License-Status"] = status.Reason;

        // HTTP status kodining o'zi 403 — javob tanasida takrorlanmaydi.
        return ctx.Response.WriteAsJsonAsync(new
        {
            succeeded = false,
            licenseExpired = true,
            reason = status.Reason,
            errors = new[] { status.Message },
        });
    }
}
