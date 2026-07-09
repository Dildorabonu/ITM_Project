using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace Application.Licensing;

/// <summary>
/// Server "barmoq izi" — litsenziyani muayyan mashinaga bog'lash uchun. Windows'da
/// o'rnatishga xos MachineGuid (registr), Linux'da /etc/machine-id ishlatiladi.
/// Xom qiymat oshkor qilinmasligi uchun SHA256 bilan xeshlanadi.
/// </summary>
public static class MachineFingerprint
{
    private static string? _cached;

    public static string Get()
    {
        if (_cached != null) return _cached;

        var raw = ReadRawId() ?? "unknown-machine";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("ITM|" + raw));
        _cached = Convert.ToHexString(hash)[..16];
        return _cached;
    }

    private static string? ReadRawId()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
                if (key?.GetValue("MachineGuid") is string guid && !string.IsNullOrWhiteSpace(guid))
                    return guid;
            }
            else
            {
                foreach (var path in new[] { "/etc/machine-id", "/var/lib/dbus/machine-id" })
                {
                    if (File.Exists(path))
                    {
                        var id = File.ReadAllText(path).Trim();
                        if (id.Length > 0) return id;
                    }
                }
            }
        }
        catch
        {
            // O'qib bo'lmasa "unknown-machine" ishlatiladi.
        }
        return null;
    }
}
