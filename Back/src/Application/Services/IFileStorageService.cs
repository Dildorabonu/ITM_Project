using Microsoft.AspNetCore.Http;

namespace Application.Services;

public interface IFileStorageService
{
    /// <summary>Faylni saqlaydi va nisbiy URL qaytaradi ("/uploads/...")</summary>
    Task<string> SaveAsync(IFormFile file, string subFolder);

    /// <summary>Faylni o'chiradi. Yo'l nisbiy URL bo'lishi kerak.</summary>
    void Delete(string? relativePath);
}
