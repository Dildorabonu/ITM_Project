namespace Application.DTOs.Attachments;

public class AttachmentResponseDto
{
    public Guid Id { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
    public Guid UploadedBy { get; set; }
    public string? UploadedByFullName { get; set; }
    public string? Label { get; set; }
}
