using System.Security.Cryptography;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Helpers;

// Katalog mahsulotiga barqaror, noyob qisqa kod beradi.
// Format: "PRD-" + 3 bayt random hex (masalan "PRD-9F3A1C").
public static class ProductCatalogCodeGenerator
{
    public static string New() =>
        "PRD-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(3));

    // DB da hali mavjud bo'lmagan noyob kod qaytaradi.
    public static async Task<string> NewUniqueAsync(DatabaseContext context)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = New();
            if (await context.ProductCatalogs.AnyAsync(p => p.Code == code)) continue;
            return code;
        }

        throw new InvalidOperationException("Katalog mahsuloti uchun noyob kod yaratib bo'lmadi.");
    }
}
