using System.Net.Sockets;
using Application.DTOs.MeterData;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using NModbus;

namespace API.Services;

/// <summary>
/// Konfiguratsiyadagi har bir hisoblagichni Modbus TCP orqali faol so'rab turadi.
/// Har qurilma alohida, parallel siklda o'qiladi — biri uzilsa boshqalari
/// ta'sirlanmaydi. Har IntervalSeconds da holding registrlar o'qiladi (FC 3):
///   - Kuchlanish A: reg[StartAddress+0]  * 0.1 * PtRatio
///   - Aktiv quvvat: reg[StartAddress+11]
///   - Chastota:     reg[StartAddress+50] * 0.01
///   - Tok A:        P / U (hisoblab topiladi)
/// </summary>
public class MeterPollerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MeterPollerService> _logger;
    private readonly MeterPollerOptions _options;

    public MeterPollerService(
        IServiceScopeFactory scopeFactory,
        IOptions<MeterPollerOptions> options,
        ILogger<MeterPollerService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("Meter poller o'chirilgan (MeterPoller:Enabled=false).");
            return;
        }

        var devices = _options.ResolveDevices();

        if (devices.Count == 0)
        {
            _logger.LogInformation("Meter poller uchun qurilma sozlanmagan (MeterPoller:Devices bo'sh).");
            return;
        }

        _logger.LogInformation("Meter poller ishga tushdi: {Count} ta qurilma.", devices.Count);

        // Nom berilmagan qurilma IP ni nom sifatida oladi — bitta gateway ortidagi
        // (bir xil IP, turli SlaveId) hisoblagichlar bazada bitta qurilmaga qo'shilib
        // ketadi. Buni jimgina o'tkazib yubormaymiz.
        var duplicateNames = devices
            .GroupBy(d => d.Name, StringComparer.Ordinal)
            .Where(g => g.Count() > 1)
            .Select(g => $"{g.Key} ({g.Count()} ta)")
            .ToList();

        if (duplicateNames.Count > 0)
            _logger.LogWarning(
                "Meter poller: bir xil nomga yechilgan qurilmalar bor — {Names}. " +
                "Ularning o'lchovlari bazada bitta qurilma bo'lib qo'shiladi. " +
                "Har biriga MeterPoller:Devices ichida alohida Name bering.",
                string.Join("; ", duplicateNames));

        await Task.WhenAll(devices.Select(device => PollDeviceAsync(device, stoppingToken)));
    }

    /// <summary>Bitta qurilmaning mustaqil o'qish sikli — o'z TCP ulanishi bilan.</summary>
    private async Task PollDeviceAsync(MeterDeviceOptions device, CancellationToken stoppingToken)
    {
        var interval = _options.EffectiveInterval(device);

        _logger.LogInformation(
            "Meter [{Device}]: {Ip}:{Port} (SlaveId={SlaveId}, har {Interval}s da)",
            device.Name, device.Ip, device.Port, device.SlaveId, interval);

        var factory = new ModbusFactory();
        TcpClient? client = null;
        IModbusMaster? master = null;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(interval));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    if (client is not { Connected: true } || master is null)
                    {
                        master?.Dispose();
                        client?.Dispose();

                        client = new TcpClient();
                        using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        connectCts.CancelAfter(TimeSpan.FromSeconds(5));
                        await client.ConnectAsync(device.Ip, device.Port, connectCts.Token);

                        master = factory.CreateMaster(client);
                        master.Transport.ReadTimeout = 5000;
                        master.Transport.WriteTimeout = 5000;

                        _logger.LogInformation("Meter [{Device}] ulandi: {Ip}:{Port}",
                            device.Name, device.Ip, device.Port);
                    }

                    var regs = await master.ReadHoldingRegistersAsync(
                        (byte)device.SlaveId, (ushort)device.StartAddress, (ushort)device.RegisterCount);

                    // Registr manzillari StartAddress ga nisbatan: 100 -> [0], 111 -> [11], 150 -> [50]
                    var voltageA = regs[0] * 0.1 * device.PtRatio;
                    var powerA = regs[11] * 1.0;
                    var frequency = regs[50] * 0.01;
                    var currentA = voltageA > 0 ? powerA / voltageA : 0.0;

                    // Har o'lchov uchun bitta satr — 20 qurilmada daqiqasiga 400 satr.
                    // Operatorga kerak emas, shu sababli Debug darajasida.
                    _logger.LogDebug(
                        "Meter o'qildi [{Device}]: U={Voltage:F1} V | I={Current:F2} A | P={Power:F1} W | f={Frequency:F2} Hz",
                        device.Name, voltageA, currentA, powerA, frequency);

                    var dto = new MeterDataCreateDto
                    {
                        VoltagePhaseA = Math.Round(voltageA, 1),
                        CurrentPhaseA = Math.Round(currentA, 2),
                        ActivePower = powerA,
                        Frequency = Math.Round(frequency, 2),
                    };

                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IMeterDataService>();
                    var result = await service.CreateAsync(dto, device.Name);

                    if (!result.Succeeded)
                        _logger.LogWarning("Meter-data saqlanmadi [{Device}]: {Errors}",
                            device.Name, string.Join("; ", result.Errors));
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Meter o'qishda xato [{Device}] ({Ip}:{Port}): {Message}",
                        device.Name, device.Ip, device.Port, ex.Message);

                    // Keyingi urinishda toza ulanish ochamiz
                    master?.Dispose();
                    master = null;
                    client?.Dispose();
                    client = null;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // normal to'xtash
        }
        finally
        {
            master?.Dispose();
            client?.Dispose();
        }
    }
}
