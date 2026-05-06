using Application.DTOs;
using Application.DTOs.Shipments;

namespace Application.Services;

public interface IShipmentBatchService
{
    Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> GetByContractAsync(Guid contractId, Guid? contractProductId);
    Task<ApiResult<ShipmentBatchResponseDto>> CreateAsync(ShipmentBatchCreateDto dto, Guid userId);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
