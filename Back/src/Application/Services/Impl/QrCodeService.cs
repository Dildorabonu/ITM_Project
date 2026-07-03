using QRCoder;

namespace Application.Services.Impl;

public class QrCodeService : IQrCodeService
{
    public string RenderPngBase64(string payload)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(6);
        return Convert.ToBase64String(pngBytes);
    }
}