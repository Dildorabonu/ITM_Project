using Application.DTOs;
using Application.DTOs.Energy;
using Application.Helpers;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Application.Services.Impl;

public class EnergySummaryService : IEnergySummaryService
{
    /// <summary>Qurilma "onlayn" hisoblanishi uchun oxirgi yozuv shu muddat ichida bo'lishi kerak.</summary>
    private static readonly TimeSpan MinOnlineWindow = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Xom yozuvlardan qurilma nomlarini qidirishda ("loose index scan")
    /// bajariladigan qadamlar chegarasi — kutilmagan holatda cheksiz aylanmaslik uchun.
    /// </summary>
    private const int MaxDeviceProbes = 500;

    private readonly DatabaseContext _context;
    private readonly MeterPollerOptions _pollerOptions;
    private readonly Func<DateTime> _nowUtc;

    public EnergySummaryService(DatabaseContext context, IOptions<MeterPollerOptions> pollerOptions)
        : this(context, pollerOptions, () => DateTime.UtcNow)
    {
    }

    /// <summary>Test uchun — "hozir"ni tashqaridan berish imkoni bilan.</summary>
    public EnergySummaryService(
        DatabaseContext context,
        IOptions<MeterPollerOptions> pollerOptions,
        Func<DateTime> nowUtc)
    {
        _context = context;
        _pollerOptions = pollerOptions.Value;
        _nowUtc = nowUtc;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Umumiy ko'rinish
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<EnergySummaryDto>> GetSummaryAsync(string? period)
    {
        var now = _nowUtc();
        var (from, to, bucket, periodKey) = EnergyPeriod.Resolve(period, now);

        // Rollup soat aniqligida — davr boshini soat chegarasiga tushiramiz.
        var fromHour = FloorHour(from);

        var tariffs = await _context.EnergyTariffs.AsNoTracking().ToListAsync();
        var hours = await LoadHoursAsync(fromHour, now, device: null);
        var statuses = await LoadStatusesAsync(now);

        var bucketKeys = EnergyPeriod.BucketKeys(fromHour, now, bucket);
        var currency = tariffs.FirstOrDefault()?.Currency ?? "so'm";

        // Har soat o'z tarifidan baholanadi — tarif davr o'rtasida o'zgargan bo'lsa ham to'g'ri.
        var costOf = (HourAggregate h) =>
        {
            var price = TariffResolver.PriceAt(tariffs, h.HourUtc);
            return price is null ? (decimal?)null : (decimal)h.Kwh * price.Value;
        };

        // Umumiy vaqt qatori
        var series = BuildSeries(hours, bucketKeys, bucket, costOf);

        // Qurilmalar bo'yicha
        var deviceNames = statuses.Keys
            .Union(hours.Select(h => h.DeviceName))
            .Distinct()
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalKwh = hours.Sum(h => h.Kwh);

        var devices = new List<DeviceEnergyDto>();
        var byDevice = new List<DeviceSeriesDto>();

        foreach (var name in deviceNames)
        {
            var deviceHours = hours.Where(h => h.DeviceName == name).ToList();
            var devicePoints = BuildSeries(deviceHours, bucketKeys, bucket, costOf);
            var deviceKwh = deviceHours.Sum(h => h.Kwh);
            var status = statuses.GetValueOrDefault(name);

            devices.Add(new DeviceEnergyDto
            {
                DeviceName = name,
                Kwh = deviceKwh,
                Cost = SumCost(devicePoints),
                SharePercent = totalKwh > 0 ? deviceKwh / totalKwh * 100 : 0,
                AvgPowerW = AveragePower(deviceKwh, fromHour, now),
                PeakPowerW = deviceHours.Count == 0 ? 0 : deviceHours.Max(h => h.PeakPowerW),
                LastPowerW = status?.LastPowerW,
                LastSeen = status?.LastSeen,
                IsOnline = status?.IsOnline ?? false,
                Sparkline = devicePoints.Select(p => p.Kwh).ToList(),
            });

            byDevice.Add(new DeviceSeriesDto { DeviceName = name, Points = devicePoints });
        }

        var peak = hours.Count == 0 ? (HourAggregate?)null : hours.MaxBy(h => h.PeakPowerW);
        var online = devices.Where(d => d.IsOnline).ToList();

        var dto = new EnergySummaryDto
        {
            From = fromHour,
            To = to,
            PeriodKey = periodKey,
            Bucket = bucket,
            PricePerKwh = TariffResolver.PriceAt(tariffs, now),
            Currency = currency,
            Series = series,
            Devices = devices.OrderByDescending(d => d.Kwh).ToList(),
            ByDevice = byDevice,
            Total = new EnergyTotalsDto
            {
                Kwh = totalKwh,
                Cost = SumCost(series),
                AvgPowerW = AveragePower(totalKwh, fromHour, now),
                PeakPowerW = peak?.PeakPowerW ?? 0,
                PeakAt = peak?.HourUtc,
                CurrentPowerW = online.Sum(d => d.LastPowerW ?? 0),
                DeviceCount = devices.Count,
                OnlineCount = online.Count,
            },
        };

        return ApiResult<EnergySummaryDto>.Success(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Qurilma detali
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<DeviceEnergyDetailDto>> GetDeviceDetailAsync(string deviceName, string? period)
    {
        if (string.IsNullOrWhiteSpace(deviceName))
            return ApiResult<DeviceEnergyDetailDto>.Failure(["Qurilma nomi ko'rsatilmagan."], 400);

        var name = deviceName.Trim();
        var now = _nowUtc();
        var statuses = await LoadStatusesAsync(now);

        if (!statuses.ContainsKey(name))
            return ApiResult<DeviceEnergyDetailDto>.Failure(["Qurilma topilmadi."], 404);

        var (from, to, bucket, periodKey) = EnergyPeriod.Resolve(period, now);
        var fromHour = FloorHour(from);

        var tariffs = await _context.EnergyTariffs.AsNoTracking().ToListAsync();
        var hours = await LoadHoursAsync(fromHour, now, name);
        var bucketKeys = EnergyPeriod.BucketKeys(fromHour, now, bucket);

        var byBucket = hours
            .GroupBy(h => EnergyPeriod.BucketKey(h.HourUtc, bucket))
            .ToDictionary(g => g.Key, g => g.ToList());

        var series = bucketKeys.Select(key =>
        {
            var rows = byBucket.GetValueOrDefault(key) ?? [];
            var kwh = rows.Sum(r => r.Kwh);

            return new DeviceDetailPointDto
            {
                Bucket = key,
                Kwh = kwh,
                Cost = SumCost(rows, tariffs),
                AvgPowerW = rows.Count == 0 ? 0 : rows.Average(r => r.AvgPowerW),
                PeakPowerW = rows.Count == 0 ? 0 : rows.Max(r => r.PeakPowerW),
            };
        }).ToList();

        var totalKwh = hours.Sum(h => h.Kwh);
        var peak = hours.Count == 0 ? (HourAggregate?)null : hours.MaxBy(h => h.PeakPowerW);
        var status = statuses[name];

        // Kuchlanish/chastota — DB tomonda agregat, qator ko'chirilmaydi.
        var stats = await _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.DeviceName == name && r.CreatedAt >= fromHour && r.CreatedAt <= now)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                AvgVoltage = g.Average(x => x.VoltagePhaseA),
                MinVoltage = g.Min(x => x.VoltagePhaseA),
                MaxVoltage = g.Max(x => x.VoltagePhaseA),
                AvgFrequency = g.Average(x => x.Frequency),
            })
            .FirstOrDefaultAsync();

        var dto = new DeviceEnergyDetailDto
        {
            DeviceName = name,
            IsOnline = status.IsOnline,
            LastSeen = status.LastSeen,
            From = fromHour,
            To = to,
            PeriodKey = periodKey,
            Bucket = bucket,
            PricePerKwh = TariffResolver.PriceAt(tariffs, now),
            Currency = tariffs.FirstOrDefault()?.Currency ?? "so'm",
            Kwh = totalKwh,
            Cost = SumCost(hours, tariffs),
            AvgPowerW = AveragePower(totalKwh, fromHour, now),
            PeakPowerW = peak?.PeakPowerW ?? 0,
            PeakAt = peak?.HourUtc,
            UptimePercent = UptimePercent(hours, fromHour, now),
            AvgVoltage = stats?.AvgVoltage ?? 0,
            MinVoltage = stats?.MinVoltage ?? 0,
            MaxVoltage = stats?.MaxVoltage ?? 0,
            AvgFrequency = stats?.AvgFrequency ?? 0,
            Series = series,
        };

        return ApiResult<DeviceEnergyDetailDto>.Success(dto);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Qurilmalar ro'yxati
    // ─────────────────────────────────────────────────────────────────────

    public async Task<ApiResult<IEnumerable<MeterDeviceStatusDto>>> GetDeviceStatusesAsync()
    {
        var statuses = await LoadStatusesAsync(_nowUtc());

        var list = statuses.Values
            .OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .Select(s => new MeterDeviceStatusDto
            {
                Name = s.Name,
                IsOnline = s.IsOnline,
                LastSeen = s.LastSeen,
                LastPowerW = s.LastPowerW,
                IsConfigured = s.IsConfigured,
            })
            .ToList();

        return ApiResult<IEnumerable<MeterDeviceStatusDto>>.Success(list);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Ichki yordamchilar
    // ─────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Davrdagi soatlik agregatlar: tugallangan soatlar rollupdan, joriy soat
    /// xom o'lchovlardan (rollup 5 daqiqagacha kechikishi mumkin).
    /// </summary>
    private async Task<List<HourAggregate>> LoadHoursAsync(DateTime fromHour, DateTime now, string? device)
    {
        var currentHour = FloorHour(now);

        var query = _context.MeterEnergyHourly
            .AsNoTracking()
            .Where(r => r.HourUtc >= fromHour && r.HourUtc < currentHour);

        if (device is not null)
            query = query.Where(r => r.DeviceName == device);

        var hours = await query
            .Select(r => new HourAggregate(
                r.DeviceName, r.HourUtc, r.Kwh, r.AvgPowerW, r.PeakPowerW, r.SampleCount))
            .ToListAsync();

        hours.AddRange(await ComputeCurrentHourAsync(currentHour, now, device));
        return hours;
    }

    /// <summary>
    /// Joriy (tugallanmagan) soatni xom o'lchovlardan hisoblaydi. Soat boshidan
    /// oldingi "anchor" namuna ham olinadi — birinchi interval energiyasi yo'qolmasin.
    /// </summary>
    private async Task<List<HourAggregate>> ComputeCurrentHourAsync(
        DateTime hourStart, DateTime now, string? device)
    {
        var anchorFrom = hourStart.AddSeconds(-EnergyMath.MaxGapSeconds);

        var query = _context.MeterReadings
            .AsNoTracking()
            .Where(r => r.CreatedAt >= anchorFrom && r.CreatedAt <= now);

        if (device is not null)
            query = query.Where(r => r.DeviceName == device);

        var rows = await query
            .OrderBy(r => r.DeviceName)
            .ThenBy(r => r.CreatedAt)
            .Select(r => new { r.DeviceName, r.CreatedAt, r.ActivePower })
            .ToListAsync();

        var result = new List<HourAggregate>();

        foreach (var group in rows.GroupBy(r => r.DeviceName))
        {
            var ordered = group.OrderBy(r => r.CreatedAt).ToList();

            var samples = ordered
                .Select(r => new PowerSample(r.CreatedAt, r.ActivePower))
                .ToList();

            var kwh = EnergyMath.ComputeKwh(samples);

            // Statistika faqat shu soatga tushgan namunalardan.
            var inside = ordered.Where(r => r.CreatedAt >= hourStart).ToList();

            if (inside.Count == 0 && kwh <= 0)
                continue;

            result.Add(new HourAggregate(
                group.Key,
                hourStart,
                kwh,
                inside.Count == 0 ? 0 : inside.Average(r => r.ActivePower),
                inside.Count == 0 ? 0 : inside.Max(r => r.ActivePower),
                inside.Count));
        }

        return result;
    }

    /// <summary>
    /// Qurilmalar holati: konfiguratsiyadagilar bilan bazada uchraganlarning birlashmasi.
    /// Kalit — qurilma nomi.
    /// </summary>
    private async Task<Dictionary<string, DeviceStatus>> LoadStatusesAsync(DateTime now)
    {
        var configured = _pollerOptions.ResolveDevices();

        // Rollup — kichik jadval (qurilmalar × soatlar). Undan ham nomlar, ham
        // "oxirgi ko'rilgan"ning soat aniqligidagi zaxira qiymati olinadi.
        var rollupLastSeen = await _context.MeterEnergyHourly
            .AsNoTracking()
            .GroupBy(r => r.DeviceName)
            .Select(g => new { Device = g.Key, Last = g.Max(x => x.HourUtc) })
            .ToListAsync();

        var rollupIndex = rollupLastSeen.ToDictionary(r => r.Device, r => r.Last, StringComparer.Ordinal);

        // Barcha ma'lum qurilmalar: konfiguratsiya ∪ rollup ∪ xom yozuvlar.
        var names = configured.Select(d => d.Name)
            .Concat(rollupIndex.Keys)
            .Concat(await LoadRawDeviceNamesAsync())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var configuredIndex = configured.ToDictionary(d => d.Name, d => d, StringComparer.Ordinal);
        var statuses = new Dictionary<string, DeviceStatus>(StringComparer.Ordinal);

        foreach (var name in names)
        {
            var isConfigured = configuredIndex.TryGetValue(name, out var device);

            var status = new DeviceStatus
            {
                Name = name,
                IsConfigured = isConfigured,
            };

            // Bitta indeks seek: (DeviceName, CreatedAt) bo'yicha oxirgi qator.
            // Butun tarixni GROUP BY qilishning o'rniga qurilma boshiga bitta so'rov —
            // 17 mln qatorli jadvalda farq soniyalar bilan o'lchanadi.
            var last = await _context.MeterReadings
                .AsNoTracking()
                .Where(r => r.DeviceName == name && r.CreatedAt <= now)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new { r.CreatedAt, r.ActivePower })
                .FirstOrDefaultAsync();

            var lastSeen = last?.CreatedAt;

            // Xom yozuv topilmasa (masalan yozuvlar tozalangan, rollup qolgan) —
            // soat aniqligidagi zaxira qiymat.
            if (rollupIndex.TryGetValue(name, out var rollupHour) &&
                (lastSeen is null || rollupHour > lastSeen.Value))
            {
                lastSeen = rollupHour;
            }

            if (lastSeen is not null)
            {
                var threshold = isConfigured
                    ? OnlineThreshold(_pollerOptions.EffectiveInterval(device!))
                    : OnlineThreshold(_pollerOptions.IntervalSeconds);

                status.LastSeen = lastSeen;
                status.IsOnline = now - lastSeen.Value <= threshold;
                status.LastPowerW = status.IsOnline ? last?.ActivePower : null;
            }

            statuses[name] = status;
        }

        return statuses;
    }

    /// <summary>
    /// Xom o'lchovlardagi turli qurilma nomlari. Oddiy <c>DISTINCT</c> butun
    /// jadvalni (17 mln+ qator) o'qishga majbur qilardi; buning o'rniga
    /// "loose index scan" — har qadamda (DeviceName, CreatedAt) indeksidan
    /// keyingi nomni bitta seek bilan olamiz. So'rovlar soni qurilmalar soniga
    /// bog'liq, qatorlar soniga emas.
    /// </summary>
    private async Task<List<string>> LoadRawDeviceNamesAsync()
    {
        var names = new List<string>();
        string? cursor = null;

        for (var i = 0; i < MaxDeviceProbes; i++)
        {
            var query = _context.MeterReadings.AsNoTracking();

            if (cursor is not null)
            {
                var bound = cursor;
                query = query.Where(r => string.Compare(r.DeviceName, bound) > 0);
            }

            var next = await query
                .OrderBy(r => r.DeviceName)
                .Select(r => r.DeviceName)
                .FirstOrDefaultAsync();

            if (next is null)
                break;

            names.Add(next);
            cursor = next;
        }

        return names;
    }

    /// <summary>Onlayn deb hisoblash oynasi: 3 × o'qish davri, lekin kamida 30 soniya.</summary>
    private static TimeSpan OnlineThreshold(int intervalSeconds)
    {
        var interval = Math.Max(1, intervalSeconds);
        var window = TimeSpan.FromSeconds(interval * 3);
        return window < MinOnlineWindow ? MinOnlineWindow : window;
    }

    private static List<EnergyBucketPointDto> BuildSeries(
        List<HourAggregate> hours,
        IReadOnlyList<string> bucketKeys,
        string bucket,
        Func<HourAggregate, decimal?> costOf)
    {
        var grouped = hours
            .GroupBy(h => EnergyPeriod.BucketKey(h.HourUtc, bucket))
            .ToDictionary(g => g.Key, g => g.ToList());

        return bucketKeys.Select(key =>
        {
            var rows = grouped.GetValueOrDefault(key) ?? [];

            decimal? cost = null;
            foreach (var row in rows)
            {
                var rowCost = costOf(row);
                if (rowCost is null) continue;
                cost = (cost ?? 0m) + rowCost.Value;
            }

            return new EnergyBucketPointDto
            {
                Bucket = key,
                Kwh = rows.Sum(r => r.Kwh),
                Cost = cost,
            };
        }).ToList();
    }

    private static decimal? SumCost(IEnumerable<EnergyBucketPointDto> points)
    {
        decimal? total = null;

        foreach (var point in points)
        {
            if (point.Cost is null) continue;
            total = (total ?? 0m) + point.Cost.Value;
        }

        return total;
    }

    private static decimal? SumCost(IEnumerable<HourAggregate> hours, IReadOnlyList<EnergyTariff> tariffs)
    {
        decimal? total = null;

        foreach (var hour in hours)
        {
            var price = TariffResolver.PriceAt(tariffs, hour.HourUtc);
            if (price is null) continue;
            total = (total ?? 0m) + (decimal)hour.Kwh * price.Value;
        }

        return total;
    }

    /// <summary>Davr davomidagi o'rtacha quvvat (W) = energiya / vaqt.</summary>
    private static double AveragePower(double kwh, DateTime fromUtc, DateTime toUtc)
    {
        var hours = (toUtc - fromUtc).TotalHours;
        return hours <= 0 ? 0 : kwh * 1000d / hours;
    }

    /// <summary>Haqiqiy o'lchovlar sonining kutilgan songa nisbati (0–100).</summary>
    private double UptimePercent(List<HourAggregate> hours, DateTime fromUtc, DateTime toUtc)
    {
        var seconds = (toUtc - fromUtc).TotalSeconds;
        var interval = Math.Max(1, _pollerOptions.IntervalSeconds);
        var expected = seconds / interval;

        if (expected <= 0)
            return 0;

        var actual = hours.Sum(h => h.SampleCount);
        return Math.Min(100, actual / expected * 100);
    }

    private static DateTime FloorHour(DateTime value) =>
        new(value.Year, value.Month, value.Day, value.Hour, 0, 0, DateTimeKind.Utc);

    private readonly record struct HourAggregate(
        string DeviceName,
        DateTime HourUtc,
        double Kwh,
        double AvgPowerW,
        double PeakPowerW,
        int SampleCount);

    private sealed class DeviceStatus
    {
        public string Name { get; init; } = string.Empty;
        public bool IsConfigured { get; init; }
        public bool IsOnline { get; set; }
        public DateTime? LastSeen { get; set; }
        public double? LastPowerW { get; set; }
    }
}
