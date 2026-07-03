using System.Security.Cryptography;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Helpers;

// Omborga kirib kelayotgan har bir Productga barqaror, skanerlanadigan qisqa kod beradi.
// Format: "P-" + 3 bayt random hex (masalan "P-9F3A1C"). HID skaner uchun sodda payload.
public static class ProductCodeGenerator
{
    public static string New() =>
        "P-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(3));

    // DB da va shu unit-of-work ichida hali saqlanmagan kodlar bilan to'qnashmaydigan
    // noyob kod qaytaradi. reserved — shu tranzaksiyada allaqachon tayinlangan kodlar
    // (SaveChanges'gacha DB ko'rmaydi, shuning uchun mahalliy ham tekshiramiz).
    public static async Task<string> NewUniqueAsync(
        DatabaseContext context, ISet<string>? reserved = null)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = New();
            if (reserved is not null && reserved.Contains(code)) continue;
            if (await context.Products.AnyAsync(p => p.QrCode == code)) continue;
            reserved?.Add(code);
            return code;
        }

        throw new InvalidOperationException("Mahsulot uchun noyob QR kod yaratib bo'lmadi.");
    }
}