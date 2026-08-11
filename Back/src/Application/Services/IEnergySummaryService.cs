using Application.DTOs;
using Application.DTOs.Energy;

namespace Application.Services;

/// <summary>
/// Energiya paneli uchun agregat ma'lumot. Tugallangan soatlar
/// <c>MeterEnergyHourly</c> dan, joriy tugallanmagan soat xom
/// <c>MeterReadings</c> dan olinadi — panel so'nggi soniyagacha aniq bo'ladi.
/// </summary>
public interface IEnergySummaryService
{
    Task<ApiResult<EnergySummaryDto>> GetSummaryAsync(string? period);

    Task<ApiResult<DeviceEnergyDetailDto>> GetDeviceDetailAsync(string deviceName, string? period);

    Task<ApiResult<IEnumerable<MeterDeviceStatusDto>>> GetDeviceStatusesAsync();
}
