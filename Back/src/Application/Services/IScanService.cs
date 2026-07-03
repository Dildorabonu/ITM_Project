using Application.DTOs;
using Application.DTOs.Scan;

namespace Application.Services;

// Ombor skaneri (keyboard-wedge HID) uchun lookup + amal mantig'i.
public interface IScanService
{
    // QR kod (qisqa kod, masalan "P-9F3A1C") bo'yicha Product kartasini topadi.
    Task<ApiResult<ScanLookupDto>> LookupAsync(string code);

    // 58mm yorliq chop etish uchun minimal ma'lumot.
    Task<ApiResult<ScanLabelDto>> GetLabelAsync(Guid id);

    // Skanerdan chiqim/ko'chirish/tuzatish amali — yangilangan lookup qaytaradi.
    Task<ApiResult<ScanLookupDto>> ActionAsync(ScanActionDto dto, Guid userId);
}