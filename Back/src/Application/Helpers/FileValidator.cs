using Microsoft.AspNetCore.Http;

namespace Application.Helpers;

public static class FileValidator
{
    public const long DefaultMaxSize = 50 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jpg", ".jpeg", ".png", ".webp", ".txt"
    };

    // Magic bytes (file signatures) — birinchi N baytda kutiladigan namunalar.
    // .txt da signature yo'q, shuning uchun ro'yxatda yo'q (faqat extension tekshiriladi).
    private static readonly Dictionary<string, byte[][]> MagicBytes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"]  = new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } },                            // %PDF
        [".png"]  = new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A } },
        [".jpg"]  = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
        [".jpeg"] = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },
        [".webp"] = new[] { new byte[] { 0x52, 0x49, 0x46, 0x46 } },                            // RIFF (WEBP offset 8 da)
        [".doc"]  = new[] { new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } },    // OLE2
        [".xls"]  = new[] { new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } },
        [".ppt"]  = new[] { new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } },
        [".docx"] = new[] { new byte[] { 0x50, 0x4B, 0x03, 0x04 }, new byte[] { 0x50, 0x4B, 0x05, 0x06 }, new byte[] { 0x50, 0x4B, 0x07, 0x08 } },
        [".xlsx"] = new[] { new byte[] { 0x50, 0x4B, 0x03, 0x04 }, new byte[] { 0x50, 0x4B, 0x05, 0x06 }, new byte[] { 0x50, 0x4B, 0x07, 0x08 } },
        [".pptx"] = new[] { new byte[] { 0x50, 0x4B, 0x03, 0x04 }, new byte[] { 0x50, 0x4B, 0x05, 0x06 }, new byte[] { 0x50, 0x4B, 0x07, 0x08 } },
    };

    public static bool TryValidate(IFormFile? file, out string? error, long maxSize = DefaultMaxSize)
    {
        if (file is null || file.Length == 0)
        {
            error = "Fayl bo'sh yoki tanlanmagan.";
            return false;
        }

        if (file.Length > maxSize)
        {
            error = $"Fayl hajmi {maxSize / 1024 / 1024} MB dan oshmasligi kerak.";
            return false;
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !AllowedExt.Contains(ext))
        {
            error = $"Fayl turi ruxsat etilmagan: '{ext}'. Ruxsat etilgan turlar: {string.Join(", ", AllowedExt)}";
            return false;
        }

        if (MagicBytes.TryGetValue(ext, out var signatures))
        {
            var maxSigLen = signatures.Max(s => s.Length);
            var header = new byte[maxSigLen];

            using var stream = file.OpenReadStream();
            var read = stream.Read(header, 0, header.Length);
            if (read < maxSigLen || !signatures.Any(sig => StartsWith(header, sig)))
            {
                error = "Fayl tarkibi (magic bytes) extension bilan mos kelmaydi.";
                return false;
            }
        }

        error = null;
        return true;
    }

    private static bool StartsWith(byte[] header, byte[] signature)
    {
        if (header.Length < signature.Length) return false;
        for (var i = 0; i < signature.Length; i++)
            if (header[i] != signature[i]) return false;
        return true;
    }
}
