using System.Globalization;
using Application.Options;

namespace Application.Helpers;

/// <summary>
/// Poller'da ishlab turgan qurilma sikllarini bazadagi ro'yxat bilan solishtiradi.
/// Sozlamasi o'zgargan qurilma to'xtatilib, yangi sozlama bilan qayta ishga tushiriladi.
/// </summary>
public static class MeterDeviceDiff
{
    public static string Fingerprint(MeterDeviceOptions device, int globalIntervalSeconds) =>
        string.Join('|',
            device.Name,
            device.Ip,
            device.Port.ToString(CultureInfo.InvariantCulture),
            device.SlaveId.ToString(CultureInfo.InvariantCulture),
            device.StartAddress.ToString(CultureInfo.InvariantCulture),
            device.RegisterCount.ToString(CultureInfo.InvariantCulture),
            device.PtRatio.ToString("R", CultureInfo.InvariantCulture),
            (device.IntervalSeconds ?? globalIntervalSeconds).ToString(CultureInfo.InvariantCulture));

    /// <param name="running">Ishlab turgan sikllar: qurilma Id → fingerprint.</param>
    /// <param name="desired">Bazadagi so'ralishi kerak bo'lgan qurilmalar.</param>
    public static (IReadOnlyList<Guid> ToStop, IReadOnlyList<MeterDeviceOptions> ToStart) Compute(
        IReadOnlyDictionary<Guid, string> running,
        IReadOnlyList<MeterDeviceOptions> desired,
        int globalIntervalSeconds)
    {
        var desiredById = desired.ToDictionary(d => d.Id);

        var toStop = running
            .Where(r => !desiredById.TryGetValue(r.Key, out var device) ||
                        Fingerprint(device, globalIntervalSeconds) != r.Value)
            .Select(r => r.Key)
            .ToList();

        var toStart = desired
            .Where(d => !running.ContainsKey(d.Id) || toStop.Contains(d.Id))
            .ToList();

        return (toStop, toStart);
    }
}
