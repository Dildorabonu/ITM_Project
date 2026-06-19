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
    public StockMovementType? Type { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}
