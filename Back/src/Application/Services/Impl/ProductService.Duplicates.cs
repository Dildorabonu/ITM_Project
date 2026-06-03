using Application.DTOs;
using Application.DTOs.Products;
using Application.Helpers;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

// Mahsulot nomi o'xshashligi va dublikat tekshiruvi. Foydalanuvchini bir xil
// mahsulotni boshqacha yozib qayta kiritishidan saqlaydi (faqat ogohlantirish/bloklash).
public partial class ProductService
{
    // Berilgan nomga "o'xshash" mavjud mahsulotlarni topadi (pg_trgm similarity).
    // Maqsad: foydalanuvchi bir xil mahsulotni biroz boshqacha nom bilan (katta/kichik
    // harf, ortiqcha probel, bitta-ikki harf farqi) qayta kiritib yuborishining oldini olish.
    // Bloklamaydi — faqat ogohlantirish uchun ro'yxat qaytaradi.
    public async Task<ApiResult<IEnumerable<ProductSimilarDto>>> FindSimilarAsync(string name, Guid? departmentId, Guid? restrictToDepartmentId = null)
    {
        var term = name?.Trim() ?? string.Empty;
        if (term.Length < 2)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        // Kirill/lotin, katta-kichik harf, probel farqini yo'qotib taqqoslash uchun
        // kiritilgan nomni ham kanonik ko'rinishga keltiramiz.
        var normTerm = TextNormalizer.Normalize(term);
        if (normTerm.Length < 2)
            return ApiResult<IEnumerable<ProductSimilarDto>>.Success([]);

        // 0..1 oralig'ida; pastroq qiymat ko'proq (shovqinli) natija beradi.
        const double threshold = 0.4;

        var query = _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .AsQueryable();

        // Mahsulot nomi takrorlanmasligi bo'lim ichida tekshiriladi, shuning uchun
        // o'xshashlikni ham tanlangan bo'lim doirasida qidiramiz.
        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        // Permission cheklovi: ViewAll yo'q foydalanuvchi faqat o'z bo'limini ko'radi.
        if (restrictToDepartmentId.HasValue)
            query = query.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        var matches = await query
            .Where(p => EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm) >= threshold)
            .OrderByDescending(p => EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm))
            .Take(5)
            .Select(p => new ProductSimilarDto
            {
                Id = p.Id,
                Name = p.Name,
                InvoiceNumber = p.InvoiceNumber,
                DepartmentId = p.DepartmentId,
                DepartmentName = p.Department!.Name,
                Similarity = EF.Functions.TrigramsSimilarity(p.NameNormalized, normTerm)
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ProductSimilarDto>>.Success(matches);
    }

    // Fayldan import qilishda butun ro'yxatni bitta so'rovda tekshiradi:
    //  - bazada normalized-aynan bir xil (chinakam dublikat) — ExactDuplicate
    //  - shu fayl ichida normalized-takror — DuplicateInFile
    //  - 40%+ o'xshash mavjud mahsulotlar — Similar (faqat ogohlantirish)
    // O'xshashlik C# da (TextNormalizer.TrigramSimilarity) hisoblanadi, shunda har qator
    // uchun alohida DB so'rovi yubormaymiz.
    public async Task<ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>> CheckDuplicatesAsync(IEnumerable<ProductDuplicateCheckItemDto> items, Guid? restrictToDepartmentId = null)
    {
        var prepared = (items ?? [])
            .Select(i => new { i.Index, i.Name, i.DepartmentId, Norm = TextNormalizer.Normalize(i.Name) })
            .ToList();

        var results = new List<ProductDuplicateCheckResultDto>();
        if (prepared.Count == 0)
            return ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>.Success(results);

        const double threshold = 0.4;

        var deptIds = prepared.Select(p => p.DepartmentId).Distinct().ToList();

        var existingQuery = _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .Where(p => deptIds.Contains(p.DepartmentId));

        if (restrictToDepartmentId.HasValue)
            existingQuery = existingQuery.Where(p => p.DepartmentId == restrictToDepartmentId.Value);

        var existing = await existingQuery
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.NameNormalized,
                p.InvoiceNumber,
                p.DepartmentId,
                DepartmentName = p.Department!.Name
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

        foreach (var p in prepared)
        {
            var res = new ProductDuplicateCheckResultDto { Index = p.Index };

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
                            InvoiceNumber = exact.InvoiceNumber,
                            DepartmentId = exact.DepartmentId,
                            DepartmentName = exact.DepartmentName,
                            Similarity = 1d
                        };

                    res.Similar = pool
                        .Where(e => e.NameNormalized != p.Norm)
                        .Select(e => new { e, sim = TextNormalizer.TrigramSimilarity(e.NameNormalized, p.Norm) })
                        .Where(x => x.sim >= threshold)
                        .OrderByDescending(x => x.sim)
                        .Take(3)
                        .Select(x => new ProductSimilarDto
                        {
                            Id = x.e.Id,
                            Name = x.e.Name,
                            InvoiceNumber = x.e.InvoiceNumber,
                            DepartmentId = x.e.DepartmentId,
                            DepartmentName = x.e.DepartmentName,
                            Similarity = x.sim
                        })
                        .ToList();
                }
            }

            results.Add(res);
        }

        return ApiResult<IEnumerable<ProductDuplicateCheckResultDto>>.Success(results);
    }
}
