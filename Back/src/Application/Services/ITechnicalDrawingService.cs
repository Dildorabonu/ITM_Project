using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
using Application.Helpers;
using Core.Enums;

namespace Application.Services;

public interface ITechnicalDrawingService
{
    Task<ApiResult<PagedResult<TechnicalDrawingRowDto>>> GetPagedAsync(
        Guid currentUserId,
        bool viewAll,
        PaginationParams pagination,
        string? search = null,
        DrawingStatus? status = null,
        bool? onlyMissing = null,
        bool? isActive = null);
    Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy);
    Task<ApiResult<int>> UpdateAsync(Guid id, TechnicalDrawingUpdateDto dto);
    Task<ApiResult<int>> UpdateStatusAsync(Guid id, DrawingStatus status);
}
