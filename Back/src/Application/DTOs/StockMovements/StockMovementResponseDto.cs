using System.Text.Json.Serialization;
using Core.Enums;

namespace Application.DTOs.StockMovements;

// Jurnal qatorining EKRANDA ko'rinadigan maydonlari.
//
// Ataylab faqat nomlar bor, ID lar yo'q (ProductId, MaterialId, *DepartmentId,
// RequisitionId, ContractId, UserId): jurnal read-only, qatordan boshqa sahifaga
// o'tish yo'q, shuning uchun frontend bu ID larni hech qayerda ishlatmaydi —
// har bir qatorga 7 ta GUID qo'shish sof ortiqcha trafik edi.
public class StockMovementResponseDto
{
    public Guid Id { get; set; }

    // Frontend `type` ni satr kaliti sifatida ishlatadi (STOCK_MOVEMENT_COLOR["Reserve"],
    // STOCK_MOVEMENT_LABEL[...], stockMovementSign(...)). Defaultda System.Text.Json
    // enumni raqam qilib yuboradi — o'shanda badge ranglari, nomi va +/- ishorasi
    // yo'qoladi. Konverter ataylab shu maydonda, global emas: global qo'yilsa
    // RequisitionStatus kabi raqam kutayotgan joylar buziladi.
    //
    // Turning o'zbekcha nomi (TypeLabel) jo'natilmaydi — u `type` ning sof funksiyasi,
    // frontendda STOCK_MOVEMENT_LABEL lug'atidan olinadi.
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public StockMovementType Type { get; set; }

    public string ProductName { get; set; } = string.Empty;

    // Katalog-asosli bo'lsa to'ladi, FreeText bo'lsa null
    public string? MaterialName { get; set; }

    // IN: faqat Target; OUT: faqat Source; TRANSFER: ikkalasi ham
    public string? SourceDepartmentName { get; set; }
    public string? TargetDepartmentName { get; set; }

    public decimal Quantity { get; set; }
    public decimal QuantityAfter { get; set; }

    public string? RequisitionNo { get; set; }

    public string UserFullName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public string? Notes { get; set; }
}
