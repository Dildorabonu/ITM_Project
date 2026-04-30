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
        Guid uploadedBy, string? label = null)
    {
        var folderId = await ResolveFolderIdAsync(entityType, entityId);
        var dir = Path.Combine(_options.UploadsPath, entityType, folderId.ToString());

        Directory.CreateDirectory(dir);

        var storedName = ResolveUniqueStoredName(dir, SanitizeFileName(fileName));
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
            Label = label,
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

        var fullPath = await ResolveStoredPathAsync(entityType, entityId, attachment.StoredName);

        if (fullPath is null)
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
            var fullPath = await ResolveStoredPathAsync(entityType, entityId, attachment.StoredName);
            if (fullPath is not null && File.Exists(fullPath))
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

        var fullPath = await ResolveStoredPathAsync(entityType, entityId, attachment.StoredName);
        if (fullPath is not null && File.Exists(fullPath))
            File.Delete(fullPath);

        _context.Attachments.Remove(attachment);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    // Requisitions uchun child fayllar parent papkasiga tushadi —
    // bitta talabnoma + uning 2 ta child PDFi bir joyda turishi uchun.
    private async Task<Guid> ResolveFolderIdAsync(string entityType, Guid entityId)
    {
        if (entityType != "requisitions") return entityId;
        var parentId = await _context.Requisitions
            .Where(r => r.Id == entityId)
            .Select(r => r.ParentRequisitionId)
            .FirstOrDefaultAsync();
        return parentId ?? entityId;
    }

    // Yangi parent-folder sxemasini qo'llamasdan oldin yuklangan fayllar bor edi —
    // ular hali ham child entityId nomli papkada turibdi. Avval yangi joyga qaraymiz,
    // topilmasa eski joyga qaytamiz.
    private async Task<string?> ResolveStoredPathAsync(string entityType, Guid entityId, string storedName)
    {
        var folderId = await ResolveFolderIdAsync(entityType, entityId);
        var primary = Path.Combine(_options.UploadsPath, entityType, folderId.ToString(), storedName);
        if (File.Exists(primary)) return primary;

        if (folderId != entityId)
        {
            var legacy = Path.Combine(_options.UploadsPath, entityType, entityId.ToString(), storedName);
            if (File.Exists(legacy)) return legacy;
        }

        return null;
    }

    private static string SanitizeFileName(string raw)
    {
        var name = Path.GetFileName(raw);
        if (string.IsNullOrWhiteSpace(name))
            return $"{Guid.NewGuid()}";

        var invalid = Path.GetInvalidFileNameChars();
        var clean = new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(clean) ? $"{Guid.NewGuid()}" : clean;
    }

    private static string ResolveUniqueStoredName(string dir, string desired)
    {
        if (!File.Exists(Path.Combine(dir, desired))) return desired;

        var stem = Path.GetFileNameWithoutExtension(desired);
        var ext = Path.GetExtension(desired);
        for (var n = 1; n < 10000; n++)
        {
            var candidate = $"{stem}_{n}{ext}";
            if (!File.Exists(Path.Combine(dir, candidate))) return candidate;
        }
        return $"{Guid.NewGuid()}{ext}";
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
        Label = a.Label,
    };
}
