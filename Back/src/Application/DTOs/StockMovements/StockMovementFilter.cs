using Core.Enums;

namespace Application.DTOs.StockMovements;

// Ombor harakatlari jurnali uchun filtrlar — barchasi optional, query paramdan keladi.
// departmentId source YOKI target ga mos kelsa qamrab oladi.
public class StockMovementFilter
{
    public Guid? ProductId { get; set; }
    public Guid? MaterialId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? RequisitionId { get; set; }
    public Guid? ContractId { get; set; }
    public Guid? UserId { get; set; }
    // Bir nechta tur — ?types=Reserve&types=Release. Bo'sh bo'lsa barcha turlar.
    public List<StockMovementType>? Types { get; set; }
    // Toshkent kalendar kunlari, ikkalasi ham kiradi.
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}
