using System.Text.Json.Serialization;
using Core.Enums;

namespace Application.DTOs.StockMovements;

public class StockMovementResponseDto
{
    public Guid Id { get; set; }

    // Frontend `type` ni satr kaliti sifatida ishlatadi (STOCK_MOVEMENT_COLOR["Reserve"],
    // stockMovementSign(...)). Defaultda System.Text.Json enumni raqam qilib yuboradi —
    // o'shanda badge ranglari va +/- ishorasi yo'qoladi. Konverter ataylab shu maydonda,
    // global emas: global qo'yilsa RequisitionStatus kabi raqam kutayotgan joylar buziladi.
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public StockMovementType Type { get; set; }
    public string TypeLabel { get; set; } = string.Empty;

    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;

    // Katalog-asosli bo'lsa to'ladi, FreeText bo'lsa null
    public Guid? MaterialId { get; set; }
    public string? MaterialName { get; set; }

    // IN: faqat Target; OUT: faqat Source; TRANSFER: ikkalasi ham
    public Guid? SourceDepartmentId { get; set; }
    public string? SourceDepartmentName { get; set; }
    public Guid? TargetDepartmentId { get; set; }
    public string? TargetDepartmentName { get; set; }

    public decimal Quantity { get; set; }
    public decimal QuantityAfter { get; set; }

    public Guid? RequisitionId { get; set; }
    public string? RequisitionNo { get; set; }
    public Guid? ContractId { get; set; }

    public Guid UserId { get; set; }
    public string UserFullName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public string? Notes { get; set; }
}
