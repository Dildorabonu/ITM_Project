using Application.DTOs;
using Application.DTOs.MeterData;

namespace Application.Services;

public interface IMeterDataService
{
    Task<ApiResult<Guid>> CreateAsync(MeterDataCreateDto dto, string deviceName);
    Task<ApiResult<IEnumerable<MeterDataResponseDto>>> GetLatestAsync(string? deviceName, int take);
    Task<ApiResult<IEnumerable<string>>> GetDevicesAsync();
}
