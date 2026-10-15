using Application.DTOs;
using Application.DTOs.Energy;
using Application.Options;

namespace Application.Services;

/// <summary>Modbus TCP orqali so'raladigan hisoblagich qurilmalari (IP, port, Slave ID).</summary>
public interface IMeterDeviceService
{
    Task<ApiResult<IEnumerable<MeterDeviceDto>>> GetAllAsync();
    Task<ApiResult<Guid>> CreateAsync(MeterDeviceSaveDto dto);
    Task<ApiResult<bool>> UpdateAsync(Guid id, MeterDeviceSaveDto dto);
    Task<ApiResult<bool>> DeleteAsync(Guid id);

    /// <summary>Poller so'rashi kerak bo'lgan qurilmalar: yoqilgan va o'chirilmagan.</summary>
    Task<IReadOnlyList<MeterDeviceOptions>> GetPollTargetsAsync();

    /// <summary>
    /// appsettings'dagi qurilmalarni bazaga ko'chiradi — faqat jadvalga hali
    /// birorta ham qurilma yozilmagan bo'lsa. Import qilinganlar sonini qaytaradi.
    /// </summary>
    Task<int> ImportFromConfigAsync(IReadOnlyList<MeterDeviceOptions> devices);
}
