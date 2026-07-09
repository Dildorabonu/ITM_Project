namespace Application.Options;

public class LicenseOptions
{
    public const string SectionName = "License";

    // Imzolangan litsenziya tokeni ("payload.signature"). Bo'sh bo'lsa — tizim bloklangan.
    public string Key { get; set; } = string.Empty;

    // Ixtiyoriy: tokenni fayldan o'qish. Ko'rsatilgan va mavjud bo'lsa Key'dan ustun turadi.
    public string? KeyFilePath { get; set; }
}
