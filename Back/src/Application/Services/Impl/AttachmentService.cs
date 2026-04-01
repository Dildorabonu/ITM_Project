using Application.DTOs;
using Application.DTOs.Attachments;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SysTask = System.Threading.Tasks.Task;

namespace Application.Services.Impl;

public class AttachmentService : IAttachmentService
{
    private readonly DatabaseContext _context;
    private readonly FileStorageOptions _options;

    public AttachmentService(DatabaseContext context, IOptions<FileStorageOptions> options)
    {
        _context = context;
        _options = options.Value;
    }

    public async Task<ApiResult<IEnumerable<AttachmentResponseDto>>> GetAllAsync(string entityType, Guid entityId)
    {
        var files = await _context.Attachments
            .Include(a => a.Uploader)
            .Where(a => a.EntityType == entityType && a.EntityId == entityId)
            .OrderByDescending(a => a.UploadedAt)
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<AttachmentResponseDto>>.Success(files.Select(MapToResponse));
    }

    public async Task<ApiResult<AttachmentResponseDto>> UploadAsync(
        string entityType, Guid entityId,
        Stream fileStream, string fileName, string contentType, long fileSize,
        Guid uploadedBy)
    {
        var ext = Path.GetExtension(fileName);
        var storedName = $"{Guid.NewGuid()}{ext}";
        var dir = Path.Combine(_options.UploadsPath, entityType, entityId.ToString());

        Directory.CreateDirectory(dir);

        var fullPath = Path.Combine(dir, storedName);
        await using (var fs = File.Create(fullPath))
            await fileStream.CopyToAsync(fs);

        var attachment = new Attachment
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            FileName = fileName,
            StoredName = storedName,
            ContentType = contentType,
            FileSize = fileSize,
            UploadedAt = DateTime.UtcNow,
            UploadedBy = uploadedBy,
        };

        _context.Attachments.Add(attachment);
        await _context.SaveChangesAsync();

        var uploader = await _context.Users.FindAsync(uploadedBy);
        attachment.Uploader = uploader;

        return ApiResult<AttachmentResponseDto>.Success(MapToResponse(attachment), 201);
    }

    public async Task<ApiResult<(string filePath, string contentType, string fileName)>> GetForDownloadAsync(
        string entityType, Guid entityId, Guid fileId)
    {
        var attachment = await _context.Attachments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == fileId && a.EntityType == entityType && a.EntityId == entityId);

        if (attachment is null)
            return ApiResult<(string, string, string)>.Failure(["File not found."], 404);

        var fullPath = Path.Combine(_options.UploadsPath, entityType, entityId.ToString(), attachment.StoredName);

        if (!File.Exists(fullPath))
            return ApiResult<(string, string, string)>.Failure(["File not found on disk."], 404);

        return ApiResult<(string, string, string)>.Success((fullPath, attachment.ContentType, attachment.FileName));
    }

    public async SysTask DeleteAllAsync(string entityType, Guid entityId)
    {
        var attachments = await _context.Attachments
            .Where(a => a.EntityType == entityType && a.EntityId == entityId)
            .ToListAsync();

        foreach (var attachment in attachments)
        {
            var fullPath = Path.Combine(_options.UploadsPath, entityType, entityId.ToString(), attachment.StoredName);
            if (File.Exists(fullPath))
                File.Delete(fullPath);
        }

        _context.Attachments.RemoveRange(attachments);
        await _context.SaveChangesAsync();
    }

    public async Task<ApiResult<int>> DeleteAsync(string entityType, Guid entityId, Guid fileId)
    {
        var attachment = await _context.Attachments
            .FirstOrDefaultAsync(a => a.Id == fileId && a.EntityType == entityType && a.EntityId == entityId);

        if (attachment is null)
            return ApiResult<int>.Failure(["File not found."], 404);

        var fullPath = Path.Combine(_options.UploadsPath, entityType, entityId.ToString(), attachment.StoredName);
        if (File.Exists(fullPath))
            File.Delete(fullPath);

        _context.Attachments.Remove(attachment);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static AttachmentResponseDto MapToResponse(Attachment a) => new()
    {
        Id = a.Id,
        EntityType = a.EntityType,
        EntityId = a.EntityId,
        FileName = a.FileName,
        ContentType = a.ContentType,
        FileSize = a.FileSize,
        UploadedAt = a.UploadedAt,
        UploadedBy = a.UploadedBy,
        UploadedByFullName = a.Uploader is not null
            ? $"{a.Uploader.FirstName} {a.Uploader.LastName}"
            : null,
    };
}
