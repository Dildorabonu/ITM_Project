namespace Application.Helpers;

public static class PasswordHelper
{
    public const string StrengthRequirement =
        "Parol yetarlicha kuchli emas. Kamida 8 ta belgi, katta va kichik harf, raqam va maxsus belgi bo'lishi kerak.";

    public static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public static bool VerifyPassword(string password, string passwordHash)
    {
        return BCrypt.Net.BCrypt.Verify(password, passwordHash);
    }

    public static bool IsStrong(string password) =>
        !string.IsNullOrEmpty(password) &&
        password.Length >= 8 &&
        password.Any(char.IsUpper) &&
        password.Any(char.IsLower) &&
        password.Any(char.IsDigit) &&
        password.Any(c => !char.IsLetterOrDigit(c));
}
