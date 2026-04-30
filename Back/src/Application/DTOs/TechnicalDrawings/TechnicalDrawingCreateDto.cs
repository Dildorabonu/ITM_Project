namespace Application.DTOs.TechnicalDrawings;

public class TechnicalDrawingCreateDto
{
    public Guid ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
