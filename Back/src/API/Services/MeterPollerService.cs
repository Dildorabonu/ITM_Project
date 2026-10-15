using System.Net.Sockets;
using Application.DTOs.MeterData;
using Application.Helpers;
using Application.Options;
using Application.Services;
using Microsoft.Extensions.Options;
using NModbus;

namespace API.Services;

/// <summary>
/// Bazadagi har bir yoqilgan hisoblagichni Modbus TCP orqali faol so'rab turadi.
/// Har qurilma alohida, parallel siklda o'qiladi — biri uzilsa boshqalari
/// ta'sirlanmaydi. Qurilmalar UI dan o'zgartirilsa <see cref="MeterDeviceSignal"/>
/// orqali ro'yxat darhol qayta o'qiladi: o'zgargan qurilma sikli yangi sozlama
/// bilan qayta ishga tushadi, qolganlari uzilmaydi.
/// </summary>
public class MeterPollerService : BackgroundService
{
    /// <summary>Signal o'tkazib yuborilgan holatda ham ro'yxat shu muddatda qayta o'qiladi.</summary>
    private static readonly TimeSpan ReloadFallback = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MeterDeviceSignal _signal;
    private readonly ILogger<MeterPollerService> _logger;
    private readonly MeterPollerOptions _options;

    private readonly Dictionary<Guid, RunningDevice> _running = new();

    private sealed record RunningDevice(string Name, string Fingerprint, CancellationTokenSource Cts, Task Loop);

    public MeterPollerService(
        IServiceScopeFactory scopeFactory,
        MeterDeviceSignal signal,
        IOptions<MeterPollerOptions> options,
        ILogger<MeterPollerService> logger)
    {
        _scopeFactory = scopeFactory;
        _signal = signal;
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

        _logger.LogInformation("Meter poller ishga tushdi.");

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ReconcileAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning("Meter poller: qurilmalar ro'yxatini o'qib bo'lmadi: {Message}", ex.Message);
                }

                await _signal.WaitAsync(ReloadFallback, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // normal to'xtash
        }
        finally
        {
            await StopDevicesAsync(_running.Keys.ToList());
        }
    }

    private async Task ReconcileAsync(CancellationToken stoppingToken)
    {
        IReadOnlyList<MeterDeviceOptions> desired;

        using (var scope = _scopeFactory.CreateScope())
            desired = await scope.ServiceProvider.GetRequiredService<IMeterDeviceService>().GetPollTargetsAsync();

        var running = _running.ToDictionary(r => r.Key, r => r.Value.Fingerprint);
        var (toStop, toStart) = MeterDeviceDiff.Compute(running, desired, _options.IntervalSeconds);

        if (toStop.Count == 0 && toStart.Count == 0)
            return;

        await StopDevicesAsync(toStop);

        foreach (var device in toStart)
        {
            var cts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var fingerprint = MeterDeviceDiff.Fingerprint(device, _options.IntervalSeconds);

            _running[device.Id] = new RunningDevice(device.Name, fingerprint, cts, PollDeviceAsync(device, cts.Token));
        }

        _logger.LogInformation("Meter poller: {Count} ta qurilma so'ralmoqda.", _running.Count);
    }

    private async Task StopDevicesAsync(IReadOnlyCollection<Guid> ids)
    {
        var stopping = new List<RunningDevice>();

        foreach (var id in ids)
        {
            if (_running.Remove(id, out var device))
            {
                device.Cts.Cancel();
                stopping.Add(device);
            }
        }

        // NModbus o'qishi token qabul qilmaydi — sikl joriy o'qish tugashini
        // (ko'pi bilan IO timeout) kutib chiqadi, shuning uchun parallel kutamiz.
        await Task.WhenAll(stopping.Select(d => d.Loop));

        foreach (var device in stopping)
        {
            device.Cts.Dispose();
            _logger.LogInformation("Meter [{Device}] to'xtatildi.", device.Name);
        }
    }

    /// <summary>Bitta qurilmaning mustaqil o'qish sikli — o'z TCP ulanishi bilan.</summary>
    private async Task PollDeviceAsync(MeterDeviceOptions device, CancellationToken cancellationToken)
    {
        var interval = _options.EffectiveInterval(device);

        _logger.LogInformation(
            "Meter [{Device}]: {Ip}:{Port} (SlaveId={SlaveId}, har {Interval}s da)",
            device.Name, device.Ip, device.Port, device.SlaveId, interval);

        TcpClient? client = null;
        IModbusMaster? master = null;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(interval));

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                try
                {
                    if (client is not { Connected: true } || master is null)
                    {
                        master?.Dispose();
                        client?.Dispose();
                        master = null;
                        client = null;

                        (client, master) = await MeterModbusReader.ConnectAsync(device, cancellationToken);

                        _logger.LogInformation("Meter [{Device}] ulandi: {Ip}:{Port}",
                            device.Name, device.Ip, device.Port);
                    }

                    var sample = await MeterModbusReader.ReadAsync(master, device);

                    // Har o'lchov uchun bitta satr — 20 qurilmada daqiqasiga 400 satr.
                    // Operatorga kerak emas, shu sababli Debug darajasida.
                    _logger.LogDebug(
                        "Meter o'qildi [{Device}]: U={Voltage:F1} V | I={Current:F2} A | P={Power:F1} W | f={Frequency:F2} Hz",
                        device.Name, sample.Voltage, sample.Current, sample.Power, sample.Frequency);

                    var dto = new MeterDataCreateDto
                    {
                        VoltagePhaseA = Math.Round(sample.Voltage, 1),
                        CurrentPhaseA = Math.Round(sample.Current, 2),
                        ActivePower = sample.Power,
                        Frequency = Math.Round(sample.Frequency, 2),
                    };

                    using var scope = _scopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IMeterDataService>();
                    var result = await service.CreateAsync(dto, device.Name);

                    if (!result.Succeeded)
                        _logger.LogWarning("Meter-data saqlanmadi [{Device}]: {Errors}",
                            device.Name, string.Join("; ", result.Errors));
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
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
