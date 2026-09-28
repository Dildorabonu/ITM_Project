namespace Application.Helpers;

public static class NormAllowance
{
    // Dona bilan o'lchanadigan material bo'linmaydi — zaxirali natija eng yaqin
    // butun songa yaxlitlanadi, lekin me'yordan kam emas. Doim yuqoriga
    // yaxlitlash kichik sonlarni keskin oshirardi (1 → 2). Frontend
    // (client/lib/requisitionAllowance.ts) aynan shu ro'yxatni ishlatadi.
    private static readonly HashSet<string> PieceUnits =
        new(StringComparer.OrdinalIgnoreCase) { "шт", "дона", "dona", "қути", "пакет", "тўплам" };

    // RequisitionItem.Quantity — numeric(18,4). Ortiqcha xonani bazaning o'zi
    // yaxlitlasa PDF'dagi son bazadagidan farq qiladi, shuning uchun miqdor
    // oldindan yuqoriga yaxlitlanadi (material kam chiqmasligi uchun).
    private const decimal StoredScale = 10000m;

    // percent = 0 — zaxirasiz me'yor miqdori, u ham shu aniqlikka keltiriladi.
    public static decimal Apply(decimal quantity, string? unit, decimal percent)
    {
        if (percent == 0)
            return CeilToStoredScale(quantity);

        var raised = quantity * (100m + percent) / 100m;
        if (IsPieceUnit(unit))
            raised = Math.Max(quantity, Math.Round(raised, MidpointRounding.AwayFromZero));
        return CeilToStoredScale(raised);
    }

    public static bool IsPieceUnit(string? unit) =>
        PieceUnits.Contains((unit ?? string.Empty).Trim().TrimEnd('.'));

    private static decimal CeilToStoredScale(decimal value) =>
        Math.Ceiling(value * StoredScale) / StoredScale;
}
