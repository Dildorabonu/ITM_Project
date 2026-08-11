using Application.DTOs;
using Application.DTOs.Energy;

namespace Application.Services;

/// <summary>Elektr tariflari (1 kVt·soat narxi) — tarix bilan.</summary>
public interface IEnergyTariffService
{
    Task<ApiResult<IEnumerable<EnergyTariffDto>>> GetAllAsync();
    Task<ApiResult<Guid>> CreateAsync(EnergyTariffSaveDto dto, Guid userId);
    Task<ApiResult<bool>> UpdateAsync(Guid id, EnergyTariffSaveDto dto);
    Task<ApiResult<bool>> DeleteAsync(Guid id);
}
