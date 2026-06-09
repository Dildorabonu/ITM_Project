namespace Application.Options;

/// <summary>
/// Account lockout sozlamalari. Brute-force'dan himoya qiladi, ammo abadiy bloklash
/// (DoS) hujumiga yo'l qo'ymaydi — muvaffaqiyatsiz urinishlar vaqt oynasidan keyin
/// "eskiradi" va blok muddati tugagach hisob avtomatik tiklanadi.
/// </summary>
public class LockoutOptions
{
    public const string SectionName = "Lockout";

    /// <summary>Oynada shu sondan ko'p muvaffaqiyatsiz urinish bo'lsa hisob bloklanadi.</summary>
    public int MaxFailedAttempts { get; set; } = 5;

    /// <summary>Blok davomiyligi (daqiqa).</summary>
    public int LockoutMinutes { get; set; } = 15;

    /// <summary>
    /// Muvaffaqiyatsiz urinishlar shu oyna ichidagina hisoblanadi (daqiqa).
    /// Oynadan tashqaridagi eski urinishlar e'tiborga olinmaydi.
    /// </summary>
    public int AttemptWindowMinutes { get; set; } = 15;

    public TimeSpan LockoutDuration => TimeSpan.FromMinutes(LockoutMinutes);
    public TimeSpan AttemptWindow => TimeSpan.FromMinutes(AttemptWindowMinutes);
}
