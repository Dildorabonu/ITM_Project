using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Runtime.Versioning;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScanController : ControllerBase
{
    private readonly ILogger<ScanController> _logger;

    public ScanController(ILogger<ScanController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Windows WIA orqali ulangan skanerlar ro'yxatini qaytaradi
    /// </summary>
    [HttpGet("sources")]
    [SupportedOSPlatform("windows")]
    public IActionResult GetSources()
    {
        if (!OperatingSystem.IsWindows())
            return StatusCode(501, new { message = "Skaner faqat Windows da qo'llab-quvvatlanadi." });

        var sources = new List<object>();
        Exception? err = null;

        var thread = new Thread(() =>
        {
            try
            {
                var managerType = Type.GetTypeFromProgID("WIA.DeviceManager");
                if (managerType == null)
                {
                    err = new Exception("WIA o'rnatilmagan yoki qo'llab-quvvatlanmaydi.");
                    return;
                }

                dynamic wia = Activator.CreateInstance(managerType)!;
                var infos = wia.DeviceInfos;
                for (int i = 1; i <= infos.Count; i++)
                {
                    dynamic info = infos.Item(i);
                    // Type 1 = scanner
                    if ((int)info.Type == 1)
                    {
                        string name = info.Properties["Name"].get_Value();
                        string id = info.DeviceID;
                        sources.Add(new { id, name });
                    }
                }
            }
            catch (Exception ex)
            {
                err = ex;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (err != null)
        {
            _logger.LogError(err, "Skanerlar ro'yxatini olishda xatolik");
            return StatusCode(500, new { message = err.Message });
        }

        return Ok(sources);
    }

    /// <summary>
    /// Tanlangan skaner orqali hujjat skanerlaydi va JPEG rasmini qaytaradi
    /// </summary>
    [HttpPost]
    [SupportedOSPlatform("windows")]
    public IActionResult Scan([FromBody] ScanRequest req)
    {
        if (!OperatingSystem.IsWindows())
            return StatusCode(501, new { message = "Skaner faqat Windows da qo'llab-quvvatlanadi." });

        byte[]? imageBytes = null;
        string? fileName = null;
        Exception? err = null;

        var thread = new Thread(() =>
        {
            try
            {
                var managerType = Type.GetTypeFromProgID("WIA.DeviceManager");
                if (managerType == null) throw new Exception("WIA o'rnatilmagan.");

                dynamic wia = Activator.CreateInstance(managerType)!;
                var infos = wia.DeviceInfos;

                dynamic? targetInfo = null;
                for (int i = 1; i <= infos.Count; i++)
                {
                    dynamic info = infos.Item(i);
                    if ((string)info.DeviceID == req.DeviceId)
                    {
                        targetInfo = info;
                        break;
                    }
                }

                if (targetInfo == null) throw new Exception($"Skaner topilmadi: {req.DeviceId}");

                dynamic device = targetInfo.Connect();
                dynamic item = device.Items.Item(1);

                // Sifat sozlamalari
                SetWiaProperty(item.Properties, 6146, req.ColorMode switch
                {
                    "gray" => 2,    // Grayscale
                    "bw"   => 4,    // Black & White
                    _      => 1,    // Color (default)
                });

                // DPI (horizontal va vertical)
                int dpi = req.Dpi > 0 ? req.Dpi : 200;
                SetWiaProperty(item.Properties, 6147, dpi); // horizontal
                SetWiaProperty(item.Properties, 6148, dpi); // vertical

                // A4 o'lcham (millimetrda * 1000 / 25.4 * DPI)
                // Standart A4: 2480 x 3508 piksel (300 DPI da)
                int width  = (int)(8.27  * dpi); // A4 kenglik dyuymda
                int height = (int)(11.69 * dpi); // A4 balandlik dyuymda
                SetWiaProperty(item.Properties, 6151, width);
                SetWiaProperty(item.Properties, 6152, height);

                // Skanerlash
                string formatId = "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}"; // JPEG
                dynamic imageFile = item.Transfer(formatId);

                string tempPath = Path.Combine(Path.GetTempPath(), $"scan_{Guid.NewGuid()}.jpg");
                imageFile.SaveFile(tempPath);

                imageBytes = System.IO.File.ReadAllBytes(tempPath);
                fileName = $"scan_{DateTime.Now:yyyyMMdd_HHmmss}.jpg";
                System.IO.File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                err = ex;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (err != null)
        {
            _logger.LogError(err, "Skanerlashda xatolik");
            return StatusCode(500, new { message = err.Message });
        }

        return File(imageBytes!, "image/jpeg", fileName!);
    }

    private static void SetWiaProperty(dynamic properties, int propertyId, int value)
    {
        try
        {
            foreach (dynamic prop in properties)
            {
                if ((int)prop.PropertyID == propertyId)
                {
                    prop.set_Value(value);
                    return;
                }
            }
        }
        catch { /* Ba'zi skanerlar ba'zi xususiyatlarni qo'llab-quvvatlamaydi */ }
    }
}

public class ScanRequest
{
    public string DeviceId { get; set; } = "";
    public string ColorMode { get; set; } = "color"; // color | gray | bw
    public int Dpi { get; set; } = 200;              // 100, 150, 200, 300, 600
}
