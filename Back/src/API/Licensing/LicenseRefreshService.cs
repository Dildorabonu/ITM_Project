using Application.Services;

namespace API.Licensing;

/// <summary>
/// Har daqiqada litsenziyani qayta tekshiradi va yuqori suv belgisini yangilaydi —
/// shunda soatni ortga surish yoki muddat tugashi tez aniqlanadi.
/// </summary>
public class LicenseRefreshService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;

    public LicenseRefreshService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));

        do
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<ILicenseService>();
                await service.RefreshAsync(stoppingToken);
            }
            catch
            {
                // Xatoda ham davom etamiz — keyingi urinishda qayta tekshiriladi.
            }
        }
        while (await SafeWaitAsync(timer, stoppingToken));
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken ct)
    {
        try { return await timer.WaitForNextTickAsync(ct); }
        catch (OperationCanceledException) { return false; }
    }
}
