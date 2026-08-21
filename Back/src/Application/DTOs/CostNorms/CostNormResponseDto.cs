using Core.Enums;

namespace Application.DTOs.CostNorms;

// Metadata (imzo/tasdiq bloklari) javobda uzatilmaydi — u faqat DOCX
// qayta generatsiyasi uchun DB da saqlanadi, hech bir klient uni o'qimaydi.
public class CostNormResponseDto
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
    public List<CostNormItemResponseDto> Items { get; set; } = [];
}
