using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
using Core.Enums;

namespace Application.Services;

public interface ITechnicalDrawingService
{
    Task<ApiResult<IEnumerable<TechnicalDrawingResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, DrawingStatus? status = null, bool? isActive = null);
    Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, TechnicalDrawingUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, DrawingStatus status);
}
