namespace Application.Exceptions;

/// <summary>
/// Biznes qoidasi buzilganda tashlanadigan xatolik. GlobalExceptionHandler bu tipni
/// 400 Bad Request bilan qaytaradi va xabar matnini mijozga o'zgarishsiz yetkazadi —
/// ya'ni xabar foydalanuvchi ko'rishi mumkin bo'lgan, texnik tafsilotsiz bo'lishi kerak.
/// Kutilmagan (dasturiy) xatoliklar uchun bu tipni ISHLATMANG — ular 500 bo'lib,
/// mijozga faqat umumiy xabar qaytariladi.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }

    public DomainException(string message, Exception innerException)
        : base(message, innerException) { }
}
