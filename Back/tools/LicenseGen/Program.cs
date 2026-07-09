using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

// ITM litsenziya generatsiya vositasi. Maxfiy (private) kalit FAQAT shu yerda ishlatiladi
// va HECH QAChON ilova (API) loyihasiga yoki mijoz serveriga qo'yilmaydi.
//
// Foydalanish:
//   dotnet run -- keygen
//       -> yangi RSA juftligini yaratadi: PUBLIC key'ni ekranga chiqaradi
//          (LicenseTokenValidator.PublicKeyB64 ga qo'yiladi), PRIVATE key'ni
//          license-private.key fayliga yozadi (maxfiy saqlang, git'ga qo'ymang!).
//
//   dotnet run -- sign --customer "Korxona nomi" --days 30 [--key license-private.key]
//       -> imzolangan litsenziya tokenini chiqaradi (appsettings License:Key ga qo'yiladi).

return Run(args);

static int Run(string[] args)
{
    if (args.Length == 0)
    {
        PrintUsage();
        return 1;
    }

    switch (args[0].ToLowerInvariant())
    {
        case "keygen":
            return KeyGen();
        case "sign":
            return Sign(args);
        case "fingerprint":
            Console.WriteLine(MachineFingerprint());
            return 0;
        default:
            PrintUsage();
            return 1;
    }
}

static int KeyGen()
{
    using var rsa = RSA.Create(2048);
    var publicSpki = rsa.ExportSubjectPublicKeyInfo();
    var privatePkcs8 = rsa.ExportPkcs8PrivateKey();

    var publicB64 = Convert.ToBase64String(publicSpki);
    var privateB64 = Convert.ToBase64String(privatePkcs8);

    File.WriteAllText("license-private.key", privateB64);

    Console.WriteLine("=== PUBLIC KEY (LicenseTokenValidator.PublicKeyB64 ga qo'ying) ===");
    Console.WriteLine(publicB64);
    Console.WriteLine();
    Console.WriteLine("PRIVATE key 'license-private.key' fayliga yozildi.");
    Console.WriteLine("!!! Bu faylni MAXFIY saqlang, git'ga qo'ymang, mijozga bermang !!!");
    return 0;
}

static int Sign(string[] args)
{
    var opts = ParseOptions(args);

    if (!opts.TryGetValue("customer", out var customer) || string.IsNullOrWhiteSpace(customer))
    {
        Console.Error.WriteLine("--customer majburiy");
        return 1;
    }

    // Muddat: --days, --hours, --minutes birga qo'shiladi. Hech biri berilmasa — 30 kun.
    int days = 0, hours = 0, minutes = 0;
    var any = false;
    if (opts.TryGetValue("days", out var daysStr) && int.TryParse(daysStr, out var d)) { days = d; any = true; }
    if (opts.TryGetValue("hours", out var hoursStr) && int.TryParse(hoursStr, out var h)) { hours = h; any = true; }
    if (opts.TryGetValue("minutes", out var minStr) && int.TryParse(minStr, out var mi)) { minutes = mi; any = true; }
    if (!any) days = 30;

    var keyPath = opts.TryGetValue("key", out var kp) && !string.IsNullOrWhiteSpace(kp)
        ? kp
        : "license-private.key";

    if (!File.Exists(keyPath))
    {
        Console.Error.WriteLine($"Private key topilmadi: {keyPath}. Avval 'keygen' ishga tushiring.");
        return 1;
    }

    var privateB64 = File.ReadAllText(keyPath).Trim();

    using var rsa = RSA.Create();
    rsa.ImportPkcs8PrivateKey(Convert.FromBase64String(privateB64), out _);

    // Ixtiyoriy: tokenni muayyan serverga bog'lash. Server barmoq izini
    //   dotnet run -- fingerprint   (o'sha serverda)
    // yoki  GET /api/license/fingerprint   orqali oling.
    string? machine = opts.TryGetValue("machine", out var m) && !string.IsNullOrWhiteSpace(m) ? m.Trim() : null;

    var now = DateTime.UtcNow;
    var expires = now.AddDays(days).AddHours(hours).AddMinutes(minutes);
    var payload = new
    {
        Customer = customer,
        IssuedUtc = now,
        ExpiresUtc = expires,
        Id = Guid.NewGuid().ToString("N"),
        MachineId = machine,
    };

    var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
    var signature = rsa.SignData(payloadBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

    var token = Base64Url(payloadBytes) + "." + Base64Url(signature);

    Console.WriteLine("=== LITSENZIYA TOKENI (appsettings.Production.json -> License:Key ga qo'ying) ===");
    Console.WriteLine(token);
    Console.WriteLine();
    Console.WriteLine($"Mijoz    : {customer}");
    Console.WriteLine($"Berildi  : {now:yyyy-MM-dd HH:mm} UTC");
    Console.WriteLine($"Tugaydi  : {payload.ExpiresUtc:yyyy-MM-dd HH:mm} UTC ({days}k {hours}s {minutes}d)");
    Console.WriteLine($"Server   : {(machine ?? "(bog'lanmagan — istalgan serverda ishlaydi)")}");
    return 0;
}

// LicenseGen serverning barmoq izini API bilan bir xil usulda hisoblaydi
// (Application/Licensing/MachineFingerprint.cs bilan mos bo'lishi shart).
static string MachineFingerprint()
{
    string? raw = null;
    try
    {
        if (OperatingSystem.IsWindows())
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            if (key?.GetValue("MachineGuid") is string guid && !string.IsNullOrWhiteSpace(guid))
                raw = guid;
        }
        else
        {
            foreach (var path in new[] { "/etc/machine-id", "/var/lib/dbus/machine-id" })
            {
                if (File.Exists(path))
                {
                    var id = File.ReadAllText(path).Trim();
                    if (id.Length > 0) { raw = id; break; }
                }
            }
        }
    }
    catch { /* o'qib bo'lmadi */ }

    raw ??= "unknown-machine";
    var hash = SHA256.HashData(Encoding.UTF8.GetBytes("ITM|" + raw));
    return Convert.ToHexString(hash)[..16];
}

static Dictionary<string, string> ParseOptions(string[] args)
{
    var opts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 1; i < args.Length - 1; i++)
    {
        if (args[i].StartsWith("--"))
            opts[args[i][2..]] = args[i + 1];
    }
    return opts;
}

static string Base64Url(byte[] data) =>
    Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

static void PrintUsage()
{
    Console.WriteLine("Foydalanish:");
    Console.WriteLine("  dotnet run -- keygen");
    Console.WriteLine("  dotnet run -- fingerprint");
    Console.WriteLine("  dotnet run -- sign --customer \"Korxona nomi\" [--days 30] [--hours 2] [--minutes 5] [--machine <barmoq-izi>] [--key license-private.key]");
}
