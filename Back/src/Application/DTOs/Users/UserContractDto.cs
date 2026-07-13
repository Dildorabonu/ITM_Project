using Core.Enums;

namespace Application.DTOs.Users;

// Xodim biriktirilgan mahsulot (ContractProductUser orqali).
public class UserContractProductDto
{
    public Guid ContractProductId { get; set; }
    public string ProductType { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public ContractProductStatus Status { get; set; }
    public ContractUserRole Role { get; set; }
}

// Xodim ishlayotgan shartnoma — ContractUser (shartnoma darajasi) va
// ContractProductUser (mahsulot darajasi) yozuvlari bitta shartnomaga yig'iladi.
public class UserContractDto
{
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractParty { get; set; } = string.Empty;
    public ContractType ContractType { get; set; }
    public ContractStatus Status { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool IsActive { get; set; }

    // Shartnoma darajasidagi rol; faqat mahsulotga biriktirilgan bo'lsa — null.
    public ContractUserRole? ContractRole { get; set; }
    public List<UserContractProductDto> Products { get; set; } = [];
}
