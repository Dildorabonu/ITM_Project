namespace Core.Enums;

public enum RequisitionStatus
{
    Draft,            // Qoralama — hali yuborilmagan
    Pending,          // Direktorga yuborilgan, kutilmoqda
    Approved,         // Direktor tasdiqlagan (QR kod bor)
    Rejected,         // Direktor rad etgan
    SentToWarehouse   // Omborga yuborilgan
}
