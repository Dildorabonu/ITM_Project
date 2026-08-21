using System.Security.Cryptography;
using System.Text.Json;

namespace Application.Licensing;

// MachineId bo'sh bo'lsa — token hech qaysi serverga bog'lanmagan (istalgan joyda ishlaydi).
// To'ldirilgan bo'lsa — faqat shu barmoq iziga ega serverda amal qiladi.
public sealed record LicensePayload(string Customer, DateTime IssuedUtc, DateTime ExpiresUtc, string Id, string? MachineId = null);

/// <summary>
/// Imzolangan litsenziya tokenini faqat PUBLIC key bilan tekshiradi. Maxfiy (private)
/// kalit hech qachon shu loyihaga qo'yilmaydi — u faqat token generatsiya qiluvchi
/// alohida vositada bo'ladi. Shu sababli mijoz muddatni o'zgartira olmaydi yoki
/// yangi token yasay olmaydi.
/// </summary>
public static class LicenseTokenValidator
{
    // SubjectPublicKeyInfo (DER) formatidagi RSA public key, Base64.
    // Generatsiya vositasi (tools/LicenseGen keygen) chiqargan qiymat bilan almashtiriladi.
    private const string PublicKeyB64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAruCVLlmToiIqBlV/OjSyqxh9t9IBX31PaXYq2eyV2aqS2UsDHJxX3rqeaFy1P+vm6+DhUu03IFa3KjcIpST/WUlCRiHYwtA1bu0wmK/K2m96ZSGZeSPhbw9QfA87lQXEuZyHwmalhD67I0Dw76SclJS0kz72T1DoniYVRDWKh7gavGr18x4JiV1lyryZ5HTgxfCGGsu+eAxco17Mx72RXdjW+DVbeSSXNfXIsmID0yH+Lgyz/RTwMZrvCKpz3AdxjEMAvu24zfO131K2KMZZAb35AJ8hpgFAM0N3w8YotS6V6gHf+k8KGf+rH8/HY6iAbvyC8XuSzSinNHm9/stbkQIDAQAB";

    public static bool TryValidate(string? token, out LicensePayload? payload, out string error)
    {
        payload = null;
        error = string.Empty;

        if (string.IsNullOrWhiteSpace(token))
        {
            error = "Litsenziya kaliti mavjud emas";
            return false;
        }

        var parts = token.Trim().Split('.');
        if (parts.Length != 2)
        {
            error = "Token formati noto'g'ri";
            return false;
        }

        byte[] payloadBytes, signature;
        try
        {
            payloadBytes = Base64Url.Decode(parts[0]);
            signature = Base64Url.Decode(parts[1]);
        }
        catch
        {
            error = "Token kodlashida xato";
            return false;
        }

        try
        {
            using var rsa = RSA.Create();
            rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(PublicKeyB64), out _);
            if (!rsa.VerifyData(payloadBytes, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
            {
                error = "Imzo yaroqsiz";
                return false;
            }
        }
        catch
        {
            error = "Imzo tekshiruvi muvaffaqiyatsiz";
            return false;
        }

        try
        {
            var p = JsonSerializer.Deserialize<LicensePayload>(payloadBytes,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (p is null)
            {
                error = "Payload bo'sh";
                return false;
            }

            payload = p with
            {
                IssuedUtc = DateTime.SpecifyKind(p.IssuedUtc, DateTimeKind.Utc),
                ExpiresUtc = DateTime.SpecifyKind(p.ExpiresUtc, DateTimeKind.Utc),
            };
            return true;
        }
        catch
        {
            error = "Payload o'qib bo'lmadi";
            return false;
        }
    }
}
