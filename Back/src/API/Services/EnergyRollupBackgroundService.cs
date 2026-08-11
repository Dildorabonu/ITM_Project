using Application.Services;

namespace API.Services;

/// <summary>
/// Xom o'lchovlarni soatlik agregatga yig'ib turadi.
/// Startda bo'shliqni to'ldiradi (servis o'chib turgan davr uchun), so'ng har
/// <see cref="CycleInterval"/> da oxirgi <see cref="Lookback"/> oralig'ini qayta
/// hisoblaydi — joriy tugallanmagan soat ham to'g'ri yangilanib boradi.
/// </summary>
public class EnergyRollupBackgroundService : BackgroundService
{
    private static readonly TimeSpan CycleInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Lookback = TimeSpan.FromHours(2);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EnergyRollupBackgroundService> _logger;

    public EnergyRollupBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EnergyRollupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Migratsiya va seed tugashini kutamiz.
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        await RunSafelyAsync(
            async service =>
            {
                var written = await service.BackfillAsync(stoppingToken);
                _logger.LogInformation("Energiya rollup backfill: {Count} soat hisoblandi.", written);
            },
            stoppingToken);

        using var timer = new PeriodicTimer(CycleInterval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunSafelyAsync(
                    service => service.RollupRecentAsync(Lookback, stoppingToken),
                    stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // normal to'xtash
        }
    }

    /// <summary>Xato bo'lsa log qilib davom etamiz — servis to'xtamasligi kerak.</summary>
    private async Task RunSafelyAsync(Func<IEnergyRollupService, Task> action, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IEnergyRollupService>();
            await action(service);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // to'xtatilmoqda
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Energiya rollup xatosi: {Message}", ex.Message);
        }
    }
}
