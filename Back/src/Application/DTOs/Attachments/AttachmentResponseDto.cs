namespace Application.DTOs.Attachments;

public class AttachmentResponseDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
    public string? UploadedByFullName { get; set; }
    public string? Label { get; set; }
}
