using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractProductCreateDto
{
    // Katalog mahsulotining Id'si (ProductCatalog). Frontend mahsulotni katalogdan tanlaydi
    // yoki yangi yaratib shu Id'ni yuboradi. Berilsa — ProductType katalog nomidan olinadi.
    public Guid? ProductCatalogId { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<Guid> DepartmentIds { get; set; } = [];
    public List<ContractProductUserAssignItem> Users { get; set; } = [];
}

// Result DTOs returning generated product IDs so the client can upload per-product TZ files.
public class ContractProductIdResultDto
{
    public Guid Id { get; set; }
    public int OrderIndex { get; set; }
}

public class ContractCreateResultDto
{
    public Guid Id { get; set; }
    public List<ContractProductIdResultDto> Products { get; set; } = [];
}

public class ContractProductUserAssignItem
{
    public Guid UserId { get; set; }
    public ContractUserRole Role { get; set; }
}

public class ContractProductResponseDto
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public Guid? ProductCatalogId { get; set; }
    public string? ProductCode { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public string? Notes { get; set; }
    public ContractProductStatus Status { get; set; }
    public List<ContractDepartmentDto> Departments { get; set; } = [];
    public List<ContractUserDto> AssignedUsers { get; set; } = [];
}
