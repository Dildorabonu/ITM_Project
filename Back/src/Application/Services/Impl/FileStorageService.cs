using Application.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class FileStorageService : IFileStorageService
{
    private readonly string _root;

    public FileStorageService(IOptions<FileStorageOptions> options)
    {
        _root = options.Value.UploadsPath;
    }

    public async Task<string> SaveAsync(IFormFile file, string subFolder)
    {
        // subFolder kod tomonidan beriladi, lekin baribir traversaldan himoyalanamiz:
        // yakuniy yo'l _root ichida qolishi shart.
        var safeSubFolder = SanitizeSubFolder(subFolder);
        var folder = Path.Combine(_root, safeSubFolder);

        var rootFull = Path.GetFullPath(_root);
        var folderFull = Path.GetFullPath(folder);
        if (!folderFull.StartsWith(rootFull, StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid upload sub-folder.");

        Directory.CreateDirectory(folder);

        // Fayl nomi har doim server tomonidan yaratiladi (Guid) — foydalanuvchi nomi
        // ishlatilmaydi. Extension ham tozalanadi (faqat harf/raqam) — shubhali
        // ".aspx"/path belgilari kabi qiymatlarga yo'l qo'yilmaydi.
        var ext = SanitizeExtension(Path.GetExtension(file.FileName));
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(folder, fileName);

        await using var stream = new FileStream(fullPath, FileMode.Create);
        await file.CopyToAsync(stream);

        // "/uploads/req-items/abc123.jpg" ko'rinishida qaytaradi
        return $"/uploads/{safeSubFolder}/{fileName}";
    }

    private static string SanitizeSubFolder(string subFolder)
    {
        if (string.IsNullOrWhiteSpace(subFolder)) return "misc";
        // Faqat segment nomi — separator va ".." ni olib tashlaymiz.
        var name = Path.GetFileName(subFolder.Trim());
        var cleaned = new string(name.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
        return cleaned.Length == 0 ? "misc" : cleaned;
    }

    private static string SanitizeExtension(string? ext)
    {
        if (string.IsNullOrWhiteSpace(ext)) return string.Empty;
        var trimmed = ext.TrimStart('.').ToLowerInvariant();
        var cleaned = new string(trimmed.Where(char.IsLetterOrDigit).ToArray());
        if (cleaned.Length is 0 or > 10) return string.Empty;
        return "." + cleaned;
    }
}
