using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// Mahsulot nomi o'xshashligi va dublikat tekshiruvi. Foydalanuvchini bir xil
// mahsulotni boshqacha yozib qayta kiritishidan saqlaydi (faqat ogohlantirish/bloklash).
public partial class ProductService
{
    // Nom maydoni uchun typeahead — kiritilgan matn bilan BOSHLANADIGAN (StartsWith)
    // mavjud mahsulotlarni qaytaradi.
    public async Task<ApiResult<IEnumerable<ProductSimilarDto>>> SearchByNamePrefixAsync(string name, Guid? departmentId, Guid? restrictToDepartmentId = null)
    {
        var term = (name ?? string.Empty).Trim();
        if (term.Length < 1)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        // Kirill/lotin, katta-kichik harf, probel farqini yo'qotib taqqoslash uchun
        // kiritilgan matnni ham kanonik ko'rinishga keltiramiz va NameNormalized ustuni
        // bo'yicha qidiramiz — shunda "Болт" mahsuloti "bolt" deb yozilganda ham chiqadi.
        var normTerm = TextNormalizer.Normalize(term);
        if (normTerm.Length < 1)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        var query = _context.Products.AsNoTracking();

        // Bo'lim ichida qidiramiz (nom takrorlanmasligi bo'lim doirasida tekshiriladi).
        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        // Permission cheklovi: ViewAll yo'q foydalanuvchi faqat o'z bo'limini ko'radi.
        if (restrictToDepartmentId.HasValue)
            query = query.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        var matches = await query
            .Where(p => p.NameNormalized.StartsWith(normTerm))
            .OrderBy(p => p.Name)
            .Take(8)
            .Select(p => new ProductSimilarDto
            {
                Id = p.Id,
                Name = p.Name,
                InvoiceNumber = p.InvoiceNumber
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ProductSimilarDto>>.Success(matches);
    }

    // Fayldan import qilishda butun ro'yxatni bitta so'rovda tekshiradi:
    //  - bazada normalized-aynan bir xil (chinakam dublikat) — ExactDuplicate
    //  - shu fayl ichida normalized-takror — DuplicateInFile
    //  - bazada shu invoice raqami bor — InvoiceDuplicate
    //  - 40%+ o'xshash mavjud mahsulot — Similar (faqat ogohlantirish)
    // O'xshashlik C# da (TextNormalizer.TrigramSimilarity) hisoblanadi, shunda har qator
    // uchun alohida DB so'rovi yubormaymiz.
    public async Task<ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>> CheckDuplicatesAsync(IEnumerable<ProductDuplicateCheckItemDto> items, Guid? restrictToDepartmentId = null)
    {
        var prepared = (items ?? [])
            .Select(i => new { i.Index, i.DepartmentId, Invoice = (i.InvoiceNumber ?? string.Empty).Trim(), Norm = TextNormalizer.Normalize(i.Name) })
            .ToList();

        var results = new List<ProductDuplicateCheckResultDto>();
        if (prepared.Count == 0)
            return ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>.Success(results);

        const double threshold = 0.4;

        var deptIds = prepared.Select(p => p.DepartmentId).Distinct().ToList();

        var existingQuery = _context.Products
            .AsNoTracking()
            .Where(p => deptIds.Contains(p.DepartmentId));

        if (restrictToDepartmentId.HasValue)
            existingQuery = existingQuery.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        // Faqat taqqoslash va javob uchun kerakli ustunlar (Id javobga tushmaydi, lekin
        // ExactDuplicate/Similar ni yig'ishda ishlatiladi).
        var existing = await existingQuery
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.NameNormalized,
                p.InvoiceNumber,
                p.DepartmentId
            })
            .ToListAsync();

        var existingByDept = existing
            .GroupBy(e => e.DepartmentId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Fayl ichidagi (bo'lim + normalized nom) takrorlarini sanaymiz.
        var fileCounts = prepared
            .Where(p => p.Norm.Length > 0)
            .GroupBy(p => (p.DepartmentId, p.Norm))
            .ToDictionary(g => g.Key, g => g.Count());

        // Invoice raqami butun baza bo'yicha unikal (bo'lim ahamiyatsiz) — create shu qoidani
        // qo'llaydi. Kiritilayotgan invoice'lar bazada bor-yo'qligini bitta global so'rovda olamiz.
        var batchInvoices = prepared
            .Select(p => p.Invoice)
            .Where(inv => inv.Length > 0)
            .Distinct()
            .ToList();

        var existingInvoices = batchInvoices.Count == 0
            ? new HashSet<string>()
            : (await _context.Products
                .AsNoTracking()
                .Where(p => batchInvoices.Contains(p.InvoiceNumber))
                .Select(p => p.InvoiceNumber)
                .ToListAsync())
                .ToHashSet();

        foreach (var p in prepared)
        {
            var res = new ProductDuplicateCheckResultDto { Index = p.Index };

            res.InvoiceDuplicate = p.Invoice.Length > 0 && existingInvoices.Contains(p.Invoice);

            if (p.Norm.Length >= 2)
            {
                res.DuplicateInFile = fileCounts.TryGetValue((p.DepartmentId, p.Norm), out var c) && c > 1;

                if (existingByDept.TryGetValue(p.DepartmentId, out var pool))
                {
                    var exact = pool.FirstOrDefault(e => e.NameNormalized == p.Norm);
                    if (exact is not null)
                        res.ExactDuplicate = new ProductSimilarDto
                        {
                            Id = exact.Id,
                            Name = exact.Name,
                            InvoiceNumber = exact.InvoiceNumber
                        };

                    // UI faqat birinchi o'xshashning nomini ko'rsatadi — eng yaqinini
                    // topish uchun butun ro'yxatni ko'rib chiqamiz, lekin bittasini yuboramiz.
                    var best = pool
                        .Where(e => e.NameNormalized != p.Norm)
                        .Select(e => new { e, sim = TextNormalizer.TrigramSimilarity(e.NameNormalized, p.Norm) })
                        .Where(x => x.sim >= threshold)
                        .MaxBy(x => x.sim);

                    if (best is not null)
                        res.Similar =
                        [
                            new ProductSimilarDto
                            {
                                Id = best.e.Id,
                                Name = best.e.Name,
                                InvoiceNumber = best.e.InvoiceNumber
                            }
                        ];
                }
            }

            results.Add(res);
        }

        return ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>.Success(results);
    }
}
