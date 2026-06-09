using System.Net;
using System.Net.Sockets;

namespace Application.Helpers;

/// <summary>
/// CORS uchun origin'ni tekshiradi. Faqat localhost va xususiy (RFC 1918 / loopback /
/// ULA) IP manzillarga ruxsat beradi.
///
/// Avvalgi <c>host.StartsWith("10.")</c> kabi qator tekshiruvlari xavfli edi: hujumchi
/// nazoratidagi <c>10.attacker.com</c> yoki <c>192.168.evil.com</c> kabi domenlar ham
/// "boshlanadi" deb topilib, <c>AllowCredentials</c> bilan birga credential o'g'irlashga
/// yo'l ochardi. Bu yerda host majburiy ravishda haqiqiy IP sifatida parse qilinadi.
/// </summary>
public static class TrustedOriginValidator
{
    public static bool IsTrustedLanOrigin(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin)) return false;
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;

        // Faqat http/https sxemalariga ruxsat
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return false;

        var host = uri.Host;

        // "localhost" — yagona ruxsat etilgan nom (IP emas).
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
            return true;

        // Qolgan hamma narsa haqiqiy IP bo'lishi shart — domen nomlari ishonchsiz.
        if (!IPAddress.TryParse(host, out var ip))
            return false;

        return IsPrivateOrLoopback(ip);
    }

    public static bool IsPrivateOrLoopback(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            // 10.0.0.0/8
            if (b[0] == 10) return true;
            // 172.16.0.0/12  (172.16.* — 172.31.*)
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;
            // 192.168.0.0/16
            if (b[0] == 192 && b[1] == 168) return true;
            // 169.254.0.0/16 (link-local)
            if (b[0] == 169 && b[1] == 254) return true;
            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal) return true;
            // Unique Local Addresses fc00::/7 — birinchi bayt 0xFC yoki 0xFD
            var b = ip.GetAddressBytes();
            if ((b[0] & 0xFE) == 0xFC) return true;
            return false;
        }

        return false;
    }
}
