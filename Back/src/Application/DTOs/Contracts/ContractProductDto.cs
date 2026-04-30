namespace Application.DTOs.Contracts;

public class ContractProductCreateDto
{
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class ContractProductResponseDto
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string? Notes { get; set; }
}
