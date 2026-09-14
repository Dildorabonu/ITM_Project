namespace API.Middleware;

/// <summary>
/// Barcha backend javoblariga xavfsizlik headerlarini qo'yadi.
///
/// API javoblari odatda brauzerda hujjat sifatida ochilmasa ham, yuklangan fayllar
/// (/uploads) manzil orqali to'g'ridan-to'g'ri ochilishi mumkin — masalan yuklangan
/// SVG yoki HTML. Shuning uchun frontend (next.config.ts + middleware.ts) dagi himoya
/// backend tomonida ham takrorlanadi.
///
/// Headerlar OnStarting orqali yoziladi: javob Clear() qilinganidan keyin ham
/// (GlobalExceptionHandler) ular joyida qoladi.
/// </summary>
public class SecurityHeadersMiddleware
{
    /// <summary>
    /// Swagger UI o'zining inline skript va uslublarini ishlatadi — unga qattiq CSP
    /// qo'llanmaydi (u faqat Development muhitida va parol ostida ochiladi).
    /// </summary>
    private const string SwaggerPath = "/swagger";

    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var isSwagger = context.Request.Path.StartsWithSegments(SwaggerPath);

        context.Response.OnStarting(state =>
        {
            var ctx = (HttpContext)state;
            var headers = ctx.Response.Headers;

            // MIME sniffing — yuklangan faylni brauzer boshqa turdek talqin qilmasin
            headers["X-Content-Type-Options"] = "nosniff";
            // Klikjeking — javobni hech qaysi saytga iframe ichiga joylashtirib bo'lmaydi
            headers["X-Frame-Options"] = "DENY";
            // Tashqi manzilga o'tishda to'liq yo'l (ichida ID lar bo'lishi mumkin) ketmasin
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

            if (!isSwagger)
            {
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
                // Javob hujjat sifatida ochilib qolsa ham hech narsa yuklanmasin va
                // skript ishlamasin — yuklangan SVG/HTML orqali XSS ning oldini oladi.
                headers["Content-Security-Policy"] =
                    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; sandbox";
            }

            return Task.CompletedTask;
        }, context);

        await _next(context);
    }
}
