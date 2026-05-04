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
}
