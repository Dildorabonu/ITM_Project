namespace Application.DTOs.TechProcesses;

public class TechProcessUpdateDto
{
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public Guid? ContractProductId { get; set; }
    public bool ClearContractProduct { get; set; }
}
