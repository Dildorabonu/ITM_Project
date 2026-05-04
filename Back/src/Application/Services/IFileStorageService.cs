using Microsoft.AspNetCore.Http;

namespace Application.Services;

public interface IFileStorageService
{
    /// <summary>Faylni saqlaydi va nisbiy URL qaytaradi ("/uploads/...")</summary>
    Task<string> SaveAsync(IFormFile file, string subFolder);
}
