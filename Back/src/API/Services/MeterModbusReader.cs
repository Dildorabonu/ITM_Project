using System.Net.Sockets;
using Application.Options;
using NModbus;

namespace API.Services;

public readonly record struct MeterSample(double Voltage, double Current, double Power, double Frequency);

/// <summary>
/// Hisoblagichdan holding registrlarni (FC 3) o'qish — poller ham, "Ulanishni
/// tekshirish" ham shu yerdan foydalanadi:
///   - Kuchlanish A: reg[StartAddress+0]  * 0.1 * PtRatio
///   - Aktiv quvvat: reg[StartAddress+11]
///   - Chastota:     reg[StartAddress+50] * 0.01
///   - Tok A:        P / U (hisoblab topiladi)
/// </summary>
public static class MeterModbusReader
{
    public static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(5);
    private const int IoTimeoutMs = 5000;

    public static async Task<(TcpClient Client, IModbusMaster Master)> ConnectAsync(
        MeterDeviceOptions device, CancellationToken cancellationToken)
    {
        var client = new TcpClient();

        try
        {
            using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            connectCts.CancelAfter(ConnectTimeout);
            await client.ConnectAsync(device.Ip, device.Port, connectCts.Token);

            var master = new ModbusFactory().CreateMaster(client);
            master.Transport.ReadTimeout = IoTimeoutMs;
            master.Transport.WriteTimeout = IoTimeoutMs;

            return (client, master);
        }
        catch
        {
            client.Dispose();
            throw;
        }
    }

    public static async Task<MeterSample> ReadAsync(IModbusMaster master, MeterDeviceOptions device)
    {
        var regs = await master.ReadHoldingRegistersAsync(
            (byte)device.SlaveId, (ushort)device.StartAddress, (ushort)device.RegisterCount);

        // Registr manzillari StartAddress ga nisbatan: 100 -> [0], 111 -> [11], 150 -> [50]
        var voltage = regs[0] * 0.1 * device.PtRatio;
        var power = regs[11] * 1.0;
        var frequency = regs[50] * 0.01;
        var current = voltage > 0 ? power / voltage : 0.0;

        return new MeterSample(voltage, current, power, frequency);
    }

    /// <summary>Yangi ulanish ochib, bir marta o'qiydi va yopadi.</summary>
    public static async Task<MeterSample> ProbeAsync(MeterDeviceOptions device, CancellationToken cancellationToken)
    {
        var (client, master) = await ConnectAsync(device, cancellationToken);

        using (client)
        using (master)
            return await ReadAsync(master, device);
    }
}
