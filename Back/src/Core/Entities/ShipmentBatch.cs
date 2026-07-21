using Core.Enums;

namespace Core.Entities;

public class ShipmentBatch
{
    public Guid Id { get; set; }
    public Guid ContractId { get; set; }
    public Guid? ContractProductId { get; set; }
    public Guid? DepartmentId { get; set; }
    // Partiya turi: ishlab chiqarishdan yuborilgan partiya yoki mijoz olib
    // ketgani. BatchNo har tur uchun alohida sanaladi.
    public ShipmentBatchKind Kind { get; set; } = ShipmentBatchKind.Production;
    // CustomerPickup uchun: qaysi ishlab chiqarish partiyasidan olib ketilgani.
    // Bitta partiyadan bir necha marta qisman olib ketish mumkin — har olib
    // ketish o'z manba partiyasiga bog'lanadi va uning qoldig'ini kamaytiradi.
    public Guid? SourceBatchId { get; set; }
    public int BatchNo { get; set; }
    public decimal Amount { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Contract? Contract { get; set; }
    public ContractProduct? ContractProduct { get; set; }
    public Department? Department { get; set; }
    public User? Creator { get; set; }
    public ShipmentBatch? SourceBatch { get; set; }
}
