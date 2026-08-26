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

    // Bir yuklamada bir nechta Product uchun noyob kod. Har bir kodni alohida
    // so'rov bilan tekshirish o'rniga barcha nomzodlarni bitta so'rovda solishtiradi
    // (to'qnashuv juda kam uchraydi, shuning uchun odatda bitta aylanish yetadi).
    public static async Task<List<string>> NewUniqueBatchAsync(DatabaseContext context, int count)
    {
        var accepted = new List<string>(count);
        var assigned = new HashSet<string>();

        for (var attempt = 0; attempt < 10 && accepted.Count < count; attempt++)
        {
            var candidates = new HashSet<string>();
            while (candidates.Count < count - accepted.Count)
            {
                var code = New();
                if (!assigned.Contains(code)) candidates.Add(code);
            }

            var list = candidates.ToList();
            var taken = await context.Products
                .AsNoTracking()
                .Where(p => p.QrCode != null && list.Contains(p.QrCode))
                .Select(p => p.QrCode!)
                .ToListAsync();

            foreach (var code in candidates)
            {
                if (taken.Contains(code)) continue;
                assigned.Add(code);
                accepted.Add(code);
            }
        }

        if (accepted.Count < count)
            throw new InvalidOperationException("Mahsulot uchun noyob QR kod yaratib bo'lmadi.");

        return accepted;
    }
}