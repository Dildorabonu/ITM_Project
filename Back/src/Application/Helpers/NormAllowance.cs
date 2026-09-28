namespace Application.Helpers;

public static class NormAllowance
{
    // Dona bilan o'lchanadigan material bo'linmaydi — zaxira doim yuqoriga
    // yaxlitlanadi, aks holda material kam chiqadi. Frontend
    // (client/lib/requisitionAllowance.ts) aynan shu ro'yxatni ishlatadi.
    private static readonly HashSet<string> PieceUnits =
        new(StringComparer.OrdinalIgnoreCase) { "шт", "дона", "dona" };

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
        return CeilToStoredScale(IsPieceUnit(unit) ? Math.Ceiling(raised) : raised);
    }

    public static bool IsPieceUnit(string? unit) =>
        PieceUnits.Contains((unit ?? string.Empty).Trim().TrimEnd('.'));

    private static decimal CeilToStoredScale(decimal value) =>
        Math.Ceiling(value * StoredScale) / StoredScale;
}
