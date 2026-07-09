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
        while (!stoppingToken.IsCancellationRequested)
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

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }
}
