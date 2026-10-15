namespace Application.Services;

/// <summary>
/// Qurilmalar ro'yxati o'zgarganini poller'ga bildiradi — u ro'yxatni darhol
/// qayta o'qiydi, restart kerak bo'lmaydi. Singleton.
/// </summary>
public sealed class MeterDeviceSignal
{
    private readonly SemaphoreSlim _semaphore = new(0, 1);

    public void Notify()
    {
        // Ketma-ket bir nechta o'zgarish bitta qayta o'qishga birlashadi.
        if (_semaphore.CurrentCount == 0)
        {
            try { _semaphore.Release(); }
            catch (SemaphoreFullException) { }
        }
    }

    /// <summary>Signal kelsa true, muddat tugasa false.</summary>
    public Task<bool> WaitAsync(TimeSpan timeout, CancellationToken cancellationToken) =>
        _semaphore.WaitAsync(timeout, cancellationToken);
}
