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
        var folder = Path.Combine(_root, subFolder);
        Directory.CreateDirectory(folder);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(folder, fileName);

        await using var stream = new FileStream(fullPath, FileMode.Create);
        await file.CopyToAsync(stream);

        // "/uploads/req-items/abc123.jpg" ko'rinishida qaytaradi
        return $"/uploads/{subFolder}/{fileName}";
    }

    public void Delete(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        // "/uploads/..." → absolute path
        var relative = relativePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        // _root = ".../uploads", relative = "uploads/req-items/abc.jpg"
        // uploads papkasini ikki marta qo'shmaslik uchun:
        var uploadsSegment = "uploads" + Path.DirectorySeparatorChar;
        if (relative.StartsWith(uploadsSegment, StringComparison.OrdinalIgnoreCase))
            relative = relative[uploadsSegment.Length..];

        var fullPath = Path.Combine(_root, relative);
        if (File.Exists(fullPath))
            File.Delete(fullPath);
    }
}
