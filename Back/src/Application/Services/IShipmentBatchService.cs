using Application.DTOs;
using Application.DTOs.Shipments;
using Core.Enums;

namespace Application.Services;

public interface IShipmentBatchService
{
    Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> GetByContractAsync(Guid contractId, Guid? contractProductId, ShipmentBatchKind? kind);
    Task<ApiResult<IEnumerable<ShipmentReadyDto>>> GetReadyByContractAsync(Guid contractId);
    Task<ApiResult<ShipmentBatchResponseDto>> CreateAsync(ShipmentBatchCreateDto dto, Guid userId);
    Task<ApiResult<IEnumerable<ShipmentBatchResponseDto>>> CreatePickupAutoAsync(ShipmentPickupAutoCreateDto dto, Guid userId);
}
