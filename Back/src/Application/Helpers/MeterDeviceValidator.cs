using System.Net;
using System.Net.Sockets;
using Application.DTOs.Energy;

namespace Application.Helpers;

public static class MeterDeviceValidator
{
    /// <summary>
    /// Poller <c>reg[50]</c> (chastota) ni o'qiydi — kamida 51 ta registr kerak.
    /// Modbus bitta so'rovda 125 tadan ortiq holding registr bermaydi.
    /// </summary>
    public const int MinRegisterCount = 51;
    public const int MaxRegisterCount = 125;

    /// <summary>Ulanish parametrlari — saqlashda ham, "Ulanishni tekshirish"da ham.</summary>
    public static string? ValidateConnection(MeterDeviceSaveDto dto)
    {
        if (!IsIpv4(dto.Ip))
            return "IP manzil noto'g'ri (masalan: 192.168.30.222).";

        if (dto.Port is < 1 or > 65535)
            return "Port 1–65535 oralig'ida bo'lishi kerak.";

        if (dto.SlaveId is < 0 or > 255)
            return "Slave ID 0–255 oralig'ida bo'lishi kerak.";

        if (dto.RegisterCount is < MinRegisterCount or > MaxRegisterCount)
            return $"Registrlar soni {MinRegisterCount}–{MaxRegisterCount} oralig'ida bo'lishi kerak.";

        if (dto.StartAddress < 0 || dto.StartAddress + dto.RegisterCount - 1 > ushort.MaxValue)
            return "Boshlang'ich registr manzili noto'g'ri.";

        if (!double.IsFinite(dto.PtRatio) || dto.PtRatio <= 0)
            return "PT koeffitsiyenti noldan katta bo'lishi kerak.";

        if (dto.IntervalSeconds is < 1 or > 3600)
            return "O'qish davri 1–3600 soniya oralig'ida bo'lishi kerak.";

        return null;
    }

    public static string? Validate(MeterDeviceSaveDto dto)
    {
        var name = dto.Name?.Trim() ?? "";

        if (name.Length == 0)
            return "Qurilma nomi kiritilmagan.";

        if (name.Length > 200)
            return "Qurilma nomi 200 belgidan oshmasligi kerak.";

        return ValidateConnection(dto);
    }

    // IPAddress.TryParse "10.1" yoki "5" ni ham qabul qiladi — to'liq to'rt qismli
    // yozuvni talab qilamiz, aks holda xato kiritilgan IP jimgina boshqa manzilga aylanadi.
    private static bool IsIpv4(string? ip)
    {
        var value = ip?.Trim() ?? "";

        return value.Split('.').Length == 4 &&
               IPAddress.TryParse(value, out var address) &&
               address.AddressFamily == AddressFamily.InterNetwork;
    }
}
