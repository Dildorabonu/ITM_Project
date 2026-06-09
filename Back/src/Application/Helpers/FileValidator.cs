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
        // .webp alohida — RIFF (0..3) + "WEBP" (8..11) ikkala segment ham tekshiriladi (pastda).
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

        // .webp — RIFF konteyneri bo'lgani uchun faqat "RIFF" yetarli emas (AVI/WAV ham RIFF).
        // To'liq imzo: 0..3 = "RIFF", 8..11 = "WEBP".
        if (ext is ".webp")
        {
            if (!ValidateWebp(file))
            {
                error = "Fayl tarkibi (magic bytes) extension bilan mos kelmaydi.";
                return false;
            }
            error = null;
            return true;
        }

        if (MagicBytes.TryGetValue(ext, out var signatures))
        {
            var maxSigLen = signatures.Max(s => s.Length);
            var header = ReadHeader(file, maxSigLen);
            if (header.Length < maxSigLen || !signatures.Any(sig => StartsWith(header, sig)))
            {
                error = "Fayl tarkibi (magic bytes) extension bilan mos kelmaydi.";
                return false;
            }
        }

        error = null;
        return true;
    }

    // WEBP: RIFF....WEBP (12-bayt sarlavha). Ikkala segment ham tekshiriladi.
    private static readonly byte[] RiffMagic = { 0x52, 0x49, 0x46, 0x46 }; // "RIFF"
    private static readonly byte[] WebpMagic = { 0x57, 0x45, 0x42, 0x50 }; // "WEBP"

    private static bool ValidateWebp(IFormFile file)
    {
        var header = ReadHeader(file, 12);
        if (header.Length < 12) return false;
        return SegmentEquals(header, 0, RiffMagic) && SegmentEquals(header, 8, WebpMagic);
    }

    // Stream.Read bir martada to'liq o'qishni kafolatlamaydi — kerakli baytlarni
    // to'liq yig'ib olamiz (qisqa o'qishlardan himoya).
    private static byte[] ReadHeader(IFormFile file, int length)
    {
        var buffer = new byte[length];
        using var stream = file.OpenReadStream();
        var total = 0;
        while (total < length)
        {
            var read = stream.Read(buffer, total, length - total);
            if (read == 0) break;
            total += read;
        }
        return total == length ? buffer : buffer[..total];
    }

    private static bool SegmentEquals(byte[] header, int offset, byte[] expected)
    {
        if (header.Length < offset + expected.Length) return false;
        for (var i = 0; i < expected.Length; i++)
            if (header[offset + i] != expected[i]) return false;
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
