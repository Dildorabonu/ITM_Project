namespace Application.Services;

// QR-kod rasmini PNG (base64) sifatida render qiladi. QRCoder paketi ustida ishlaydi.
public interface IQrCodeService
{
    string RenderPngBase64(string payload);
}
