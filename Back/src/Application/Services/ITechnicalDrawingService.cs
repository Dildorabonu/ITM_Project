using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
using Core.Enums;

namespace Application.Services;

public interface ITechnicalDrawingService
{
    Task<ApiResult<IEnumerable<TechnicalDrawingResponseDto>>> GetAllAsync(DrawingStatus? status = null);
    Task<ApiResult<TechnicalDrawingResponseDto>> GetByIdAsync(Guid id);
    Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, TechnicalDrawingUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, DrawingStatus status);
    Task<ApiResult<int>> DeleteAsync(Guid id);
}
