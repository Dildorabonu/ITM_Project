using Application.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace API.Middleware;

/// <summary>
/// Ushlanmagan barcha xatoliklarni bitta joyda qayta ishlaydi: to'liq stack trace
/// serverda ILogger orqali loglanadi, mijozga esa faqat umumiy xabar va korrelyatsiya
/// ID (traceId) qaytariladi. Shu tariqa xatolik tafsilotlari (SQL matni, fayl yo'llari,
/// tip nomlari) tashqariga chiqmaydi.
///
/// Javob shakli loyihaning mavjud { succeeded, statusCode, errors } formatiga mos —
/// frontend interceptorlari va toast ko'rsatish mantig'i o'zgarishsiz ishlaydi.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private const string GenericMessage =
        "Kutilmagan xatolik yuz berdi. Administratorga murojaat qiling.";

    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception exception, CancellationToken cancellationToken)
    {
        // Mijoz ulanishni uzganda (sahifa yopildi, so'rov bekor qilindi) bu xatolik emas —
        // loglamaymiz va javob ham yozmaymiz, chunki yozadigan joy qolmagan.
        if (exception is OperationCanceledException && ctx.RequestAborted.IsCancellationRequested)
            return true;

        var traceId = ctx.TraceIdentifier;

        // Javob boshlanib bo'lgan bo'lsa (masalan fayl oqimi yarmida uzilgan) status yoki
        // tanani o'zgartirib bo'lmaydi — faqat loglaymiz va standart xatti-harakatga qaytaramiz.
        if (ctx.Response.HasStarted)
        {
            _logger.LogError(exception,
                "Unhandled exception after response started. TraceId={TraceId} Path={Path}",
                traceId, ctx.Request.Path);
            return false;
        }

        int statusCode;
        string[] errors;

        if (exception is DomainException domainException)
        {
            // Biznes qoidasi buzilishi — kutilgan holat, xabar foydalanuvchi uchun mo'ljallangan.
            statusCode = StatusCodes.Status400BadRequest;
            errors = [domainException.Message];
            _logger.LogWarning(exception,
                "Domain rule violation. TraceId={TraceId} Path={Path}", traceId, ctx.Request.Path);
        }
        else
        {
            statusCode = StatusCodes.Status500InternalServerError;
            errors = _env.IsDevelopment()
                ? [$"{exception.GetType().Name}: {exception.Message}"]
                : [GenericMessage];
            _logger.LogError(exception,
                "Unhandled exception. TraceId={TraceId} Path={Path} Method={Method} User={User}",
                traceId, ctx.Request.Path, ctx.Request.Method, ctx.User.Identity?.Name ?? "anonymous");
        }

        // Boshlangan (lekin yuborilmagan) javob boshlarini tozalaymiz — nosniff header'i
        // global middleware'da qo'yilgani uchun uni qayta tiklaymiz.
        ctx.Response.Clear();
        ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
        ctx.Response.StatusCode = statusCode;
        await ctx.Response.WriteAsJsonAsync(new
        {
            succeeded = false,
            statusCode,
            traceId,
            errors
        }, cancellationToken);

        return true;
    }
}
