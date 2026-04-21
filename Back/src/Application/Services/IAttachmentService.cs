using Application.DTOs;
using Application.DTOs.Attachments;

namespace Application.Services;

public interface IAttachmentService
{
    Task<ApiResult<IEnumerable<AttachmentResponseDto>>> GetAllAsync(string entityType, Guid entityId);
    Task<ApiResult<AttachmentResponseDto>> UploadAsync(string entityType, Guid entityId, Stream fileStream, string fileName, string contentType, long fileSize, Guid uploadedBy, string? label = null);
    Task<ApiResult<(string filePath, string contentType, string fileName)>> GetForDownloadAsync(string entityType, Guid entityId, Guid fileId);
    Task<ApiResult<int>> DeleteAsync(string entityType, Guid entityId, Guid fileId);
    Task DeleteAllAsync(string entityType, Guid entityId);
}
