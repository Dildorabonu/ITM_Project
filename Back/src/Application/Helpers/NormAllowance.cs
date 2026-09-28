namespace Application.Helpers;

public static class NormAllowance
{
    // Dona bilan o'lchanadigan material bo'linmaydi — zaxira doim yuqoriga
    // yaxlitlanadi, aks holda material kam chiqadi. Frontend
    // (client/lib/requisitionAllowance.ts) aynan shu ro'yxatni ishlatadi.
    private static readonly HashSet<string> PieceUnits =
        new(StringComparer.OrdinalIgnoreCase) { "шт", "дона", "dona" };

    public static decimal Apply(decimal quantity, string? unit, decimal percent)
    {
        if (percent == 0)
            return quantity;

        var raised = quantity * (100m + percent) / 100m;
        return IsPieceUnit(unit) ? Math.Ceiling(raised) : raised;
    }

    public static bool IsPieceUnit(string? unit) =>
        PieceUnits.Contains((unit ?? string.Empty).Trim().TrimEnd('.'));
}
