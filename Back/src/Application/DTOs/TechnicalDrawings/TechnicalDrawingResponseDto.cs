using Core.Enums;

namespace Application.DTOs.TechnicalDrawings;

public class TechnicalDrawingResponseDto
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DrawingStatus Status { get; set; }
    public Guid CreatedBy { get; set; }
    public string? CreatedByFullName { get; set; }
    public DateTime CreatedAt { get; set; }
}
