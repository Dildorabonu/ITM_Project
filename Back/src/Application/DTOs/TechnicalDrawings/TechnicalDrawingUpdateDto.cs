namespace Application.DTOs.TechnicalDrawings;

public class TechnicalDrawingUpdateDto
{
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public Guid? ContractProductId { get; set; }
    public bool ClearContractProduct { get; set; }
}
