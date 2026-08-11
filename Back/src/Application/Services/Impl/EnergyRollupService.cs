using Application.Helpers;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Task = System.Threading.Tasks.Task;

namespace Application.Services.Impl;

public class EnergyRollupService : IEnergyRollupService
{
    /// <summary>Bir marta xotiraga o'qiladigan eng katta oraliq — xotirani cheklaydi.</summary>
    private static readonly TimeSpan ChunkSize = TimeSpan.FromHours(6);

    private readonly DatabaseContext _context;
    private readonly Func<DateTime> _nowUtc;

    public EnergyRollupService(DatabaseContext context)
        : this(context, () => DateTime.UtcNow)
    {
    }

    /// <summary>Test uchun — "hozir"ni tashqaridan berish imkoni bilan.</summary>
    public EnergyRollupService(DatabaseContext context, Func<DateTime> nowUtc)
    {
        _context = context;
        _nowUtc = nowUtc;
    }

    public async Task<int> RollupRecentAsync(TimeSpan lookback, CancellationToken ct = default)
    {
        var now = _nowUtc();
        return await RollupRangeAsync(now - lookback, now, ct);
    }

    public async Task<int> BackfillAsync(CancellationToken ct = default)
    {
        // Qayerdan boshlash: oxirgi hisoblangan soatdan, u ham bo'lmasa eng erta o'lchovdan.
        var lastHour = await _context.MeterEnergyHourly
            .AsNoTracking()
            .OrderByDescending(r => r.HourUtc)
            .Select(r => (DateTime?)r.HourUtc)
            .FirstOrDefaultAsync(ct);

        var from = lastHour ?? await _context.MeterReadings
            .AsNoTracking()
            .OrderBy(r => r.CreatedAt)
            .Select(r => (DateTime?)r.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (from is null)
            return 0;

        return await RollupRangeAsync(from.Value, _nowUtc(), ct);
    }

    public async Task<int> RollupRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var from = FloorHour(fromUtc);
        var to = CeilHour(toUtc);

        if (to <= from)
            return 0;

        var total = 0;

        for (var chunkStart = from; chunkStart < to; chunkStart += ChunkSize)
        {
            ct.ThrowIfCancellationRequested();

            var chunkEnd = chunkStart + ChunkSize;
            if (chunkEnd > to)
                chunkEnd = to;

            total += await RollupChunkAsync(chunkStart, chunkEnd, ct);
        }

        return total;
    }

    /// <summary>
    /// Bitta bo'lakni hisoblaydi. Oraliq boshidan oldingi <see cref="EnergyMath.MaxGapSeconds"/>
    /// soniyalik "anchor" ham o'qiladi — birinchi interval energiyasi yo'qolmasligi uchun.
    /// </summary>
    private async Task<int> RollupChunkAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct)
    {
        var anchorFrom = fromUtc.AddSeconds(-EnergyMath.MaxGapSeconds);

        var readings = await _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.CreatedAt >= anchorFrom && r.CreatedAt < toUtc)
            .OrderBy(r => r.DeviceName)
            .ThenBy(r => r.CreatedAt)
            .Select(r => new ReadingRow(r.DeviceName, r.CreatedAt, r.ActivePower, r.VoltagePhaseA))
            .ToListAsync(ct);

        if (readings.Count == 0)
            return 0;

        // (qurilma, soat) → agregat
        var buckets = new Dictionary<(string Device, DateTime Hour), Bucket>();

        foreach (var group in readings.GroupBy(r => r.DeviceName))
        {
            // Anchor oynasidan faqat oxirgi namuna kerak — undan oldingilari
            // oldingi oyna energiyasini takroran qo'shib yuborardi.
            var ordered = EnergyMath.TrimToAnchor(
                group.OrderBy(r => r.CreatedAt), fromUtc, r => r.CreatedAt);

            for (var i = 0; i < ordered.Count; i++)
            {
                var curr = ordered[i];
                var hour = FloorHour(curr.CreatedAt);

                // Anchor o'lchovi (oraliqdan oldingi) statistikaga kirmaydi —
                // u faqat birinchi intervalning energiyasini berish uchun kerak.
                var insideRange = curr.CreatedAt >= fromUtc;

                if (insideRange)
                {
                    var bucket = GetOrAdd(buckets, (curr.DeviceName, hour));
                    bucket.Add(curr.ActivePower, curr.VoltagePhaseA);
                }

                if (i == 0)
                    continue;

                // Interval energiyasi kechki namunaning soatiga yoziladi.
                var prev = ordered[i - 1];
                var pair = new List<PowerSample>
                {
                    new(prev.CreatedAt, prev.ActivePower),
                    new(curr.CreatedAt, curr.ActivePower),
                };

                var kwh = EnergyMath.ComputeKwh(pair);
                if (kwh <= 0 || hour < FloorHour(fromUtc))
                    continue;

                GetOrAdd(buckets, (curr.DeviceName, hour)).Kwh += kwh;
            }
        }

        if (buckets.Count == 0)
            return 0;

        await UpsertAsync(buckets, fromUtc, toUtc, ct);
        return buckets.Count;
    }

    private async Task UpsertAsync(
        Dictionary<(string Device, DateTime Hour), Bucket> buckets,
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken ct)
    {
        var existing = await _context.MeterEnergyHourly
            .Where(r => r.HourUtc >= fromUtc && r.HourUtc < toUtc)
            .ToListAsync(ct);

        var index = existing.ToDictionary(r => (r.DeviceName, r.HourUtc));
        var now = DateTime.UtcNow;

        foreach (var ((device, hour), bucket) in buckets)
        {
            if (!index.TryGetValue((device, hour), out var row))
            {
                row = new MeterEnergyHourly
                {
                    Id = Guid.NewGuid(),
                    DeviceName = device,
                    HourUtc = hour,
                };
                _context.MeterEnergyHourly.Add(row);
            }

            row.Kwh = bucket.Kwh;
            row.AvgPowerW = bucket.AvgPower;
            row.PeakPowerW = bucket.SafePeakPower;
            row.MinPowerW = bucket.SafeMinPower;
            row.AvgVoltage = bucket.AvgVoltage;
            row.SampleCount = bucket.Count;
            row.UpdatedAt = now;
        }

        await _context.SaveChangesAsync(ct);

        // Change tracker'ni tozalaymiz: backfill bitta scoped kontekst ustida
        // yuzlab bo'lakni aylanib chiqadi (6 oy × 20 qurilma ≈ 87 000 qator).
        // Tozalanmasa har SaveChanges'da DetectChanges butun to'plamni qayta
        // ko'radi — vaqt kvadratik o'sadi va xotira ham bo'shamaydi.
        _context.ChangeTracker.Clear();
    }

    private static Bucket GetOrAdd(
        Dictionary<(string, DateTime), Bucket> buckets, (string Device, DateTime Hour) key)
    {
        if (!buckets.TryGetValue(key, out var bucket))
        {
            bucket = new Bucket();
            buckets[key] = bucket;
        }

        return bucket;
    }

    private static DateTime FloorHour(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, 0, 0, DateTimeKind.Utc);

    private static DateTime CeilHour(DateTime value)
    {
        var floor = FloorHour(value);
        return floor == value ? floor : floor.AddHours(1);
    }

    private readonly record struct ReadingRow(
        string DeviceName, DateTime CreatedAt, double ActivePower, double VoltagePhaseA);

    private sealed class Bucket
    {
        private double _powerSum;
        private double _voltageSum;

        public double Kwh { get; set; }
        public int Count { get; private set; }
        public double PeakPower { get; private set; } = double.MinValue;
        public double MinPower { get; private set; } = double.MaxValue;

        public double AvgPower => Count == 0 ? 0 : _powerSum / Count;
        public double AvgVoltage => Count == 0 ? 0 : _voltageSum / Count;

        /// <summary>Namuna qo'shilmagan bo'lsa sentinel (MinValue) o'rniga 0 qaytaradi.</summary>
        public double SafePeakPower => Count == 0 ? 0 : PeakPower;

        /// <summary>Namuna qo'shilmagan bo'lsa sentinel (MaxValue) o'rniga 0 qaytaradi.</summary>
        public double SafeMinPower => Count == 0 ? 0 : MinPower;

        public void Add(double powerW, double voltage)
        {
            Count++;
            _powerSum += powerW;
            _voltageSum += voltage;

            if (powerW > PeakPower) PeakPower = powerW;
            if (powerW < MinPower) MinPower = powerW;
        }
    }
}
