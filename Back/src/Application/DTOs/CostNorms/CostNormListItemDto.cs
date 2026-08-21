using Core.Enums;

namespace Application.DTOs.CostNorms;

// Ro'yxat uchun yengil payload: faqat skalyar ustunlar. Items va metadata
// bu yerda uzatilmaydi — ro'yxat UI'si ularni o'qimaydi, to'liq versiya
// GetByIdAsync dan olinadi.
public class CostNormListItemDto
{
    public Guid Id { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public Guid? ContractProductId { get; set; }
    public string? ProductType { get; set; }
    public int ContractQuantity { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DrawingStatus Status { get; set; }
    public bool IsActive { get; set; }
}
