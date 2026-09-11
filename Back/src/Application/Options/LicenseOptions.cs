namespace Application.Options;

public class LicenseOptions
{
    public const string SectionName = "License";

    // Imzolangan litsenziya tokeni ("payload.signature"). Bo'sh bo'lsa — tizim bloklangan.
    public string Key { get; set; } = string.Empty;

    // Ixtiyoriy: tokenni fayldan o'qish. Ko'rsatilgan va mavjud bo'lsa Key'dan ustun turadi.
    public string? KeyFilePath { get; set; }

    // Token butunlay yo'q bo'lganda beriladigan bepul sinov muddati (kun).
    // Birinchi ishga tushishdan sanaladi. 0 yoki manfiy bo'lsa sinov o'chiriladi.
    public int TrialDays { get; set; } = 30;
}
