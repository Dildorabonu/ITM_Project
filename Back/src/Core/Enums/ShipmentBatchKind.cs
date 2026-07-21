namespace Core.Enums;

// ShipmentBatch yozuvining turi — ikkala oqim bitta jadvalga yozadi,
// lekin ular boshqa-boshqa biznes hodisalar:
public enum ShipmentBatchKind
{
    Production = 1,       // Vazifalar sahifasidan yuborilgan partiya (hali mijozda emas)
    CustomerPickup = 2,   // Mijoz olib ketgani (shartnomalardagi "Mijozga topshirish")
}
