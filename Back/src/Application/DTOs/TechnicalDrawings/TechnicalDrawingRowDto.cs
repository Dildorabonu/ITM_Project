namespace Application.DTOs.TechnicalDrawings;

public enum TechnicalDrawingRowKind
{
    Drawing = 0,
    Empty = 1,
}

public class TechnicalDrawingRowDto
{
    public TechnicalDrawingRowKind Kind { get; set; }
    public TechnicalDrawingResponseDto? Drawing { get; set; }
    public TechnicalDrawingEmptyRowDto? Empty { get; set; }
}

public class TechnicalDrawingEmptyRowDto
{
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public Guid? ProductId { get; set; }
    public string? ProductType { get; set; }
    public int? Quantity { get; set; }
    public string? Unit { get; set; }

    // Dinamik workflow: chizma bosqichi shu mahsulot uchun hozir ish kerakmi
    // (joriy bosqich yoki undan oldin). false bo'lsa frontend "+" yaratishni
    // ko'rsatmaydi — bosqich hali navbatga kelmagan.
    public bool DrawingReachable { get; set; } = true;
}
