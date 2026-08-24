using System.Net.Sockets;
using Application.DTOs.MeterData;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using NModbus;

namespace API.Services;

/// <summary>
/// DR134 shlyuzidagi hisoblagichni Modbus TCP orqali faol so'rab turadi.
/// Har IntervalSeconds da holding registrlarni o'qiydi (Function Code 3),
/// qiymatlarni hisoblab bazaga yozadi:
///   - Kuchlanish A: reg[100] * 0.1 * PT_RATIO
///   - Aktiv quvvat: reg[111]
///   - Chastota:     reg[150] * 0.01
///   - Tok A:        P / U (hisoblab topiladi)
/// Ulanish ochiq saqlanadi; uzilsa keyingi urinishda qayta ulanadi.
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
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.Ip))
        {
            _logger.LogInformation("Meter poller o'chirilgan (MeterPoller:Enabled=false yoki Ip bo'sh).");
            return;
        }

        _logger.LogInformation(
            "Meter poller ishga tushdi: {Ip}:{Port} (SlaveId={SlaveId}, har {Interval}s da o'qiladi)",
            _options.Ip, _options.Port, _options.SlaveId, _options.IntervalSeconds);

        var factory = new ModbusFactory();
        TcpClient? client = null;
        IModbusMaster? master = null;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, _options.IntervalSeconds)));

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
                        await client.ConnectAsync(_options.Ip, _options.Port, connectCts.Token);

                        master = factory.CreateMaster(client);
                        master.Transport.ReadTimeout = 5000;
                        master.Transport.WriteTimeout = 5000;

                        _logger.LogInformation("Meter poller ulandi: {Ip}:{Port}", _options.Ip, _options.Port);
                    }

                    var regs = await master.ReadHoldingRegistersAsync(
                        (byte)_options.SlaveId, (ushort)_options.StartAddress, (ushort)_options.RegisterCount);

                    // Registr manzillari StartAddress ga nisbatan: 100 -> [0], 111 -> [11], 150 -> [50]
                    var voltageA = regs[0] * 0.1 * _options.PtRatio;
                    var powerA = regs[11] * 1.0;
                    var frequency = regs[50] * 0.01;
                    var currentA = voltageA > 0 ? powerA / voltageA : 0.0;

                    _logger.LogDebug(
                        "Meter o'qildi [{Device}]: U={Voltage:F1} V | I={Current:F2} A | P={Power:F1} W | f={Frequency:F2} Hz",
                        _options.DeviceName, voltageA, currentA, powerA, frequency);

                    var dto = new MeterDataCreateDto
                    {
                        VoltagePhaseA = Math.Round(voltageA, 1),
                        CurrentPhaseA = Math.Round(currentA, 2),
                        ActivePower = powerA,
                        Frequency = Math.Round(frequency, 2),
                    };

                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IMeterDataService>();
                    var result = await service.CreateAsync(dto, _options.DeviceName);

                    if (!result.Succeeded)
                        _logger.LogWarning("Meter-data saqlanmadi: {Errors}", string.Join("; ", result.Errors));
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Meter o'qishda xato ({Ip}:{Port}): {Message}",
                        _options.Ip, _options.Port, ex.Message);

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
