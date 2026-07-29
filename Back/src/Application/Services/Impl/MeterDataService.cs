using Application.DTOs;
using Application.DTOs.MeterData;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class MeterDataService : IMeterDataService
{
    private readonly DatabaseContext _context;

    public MeterDataService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<Guid>> CreateAsync(MeterDataCreateDto dto, string deviceName)
    {
        if (string.IsNullOrWhiteSpace(deviceName))
            return ApiResult<Guid>.Failure(["Qurilma nomi ko'rsatilmagan."], 400);

        var reading = new MeterReading
        {
            Id = Guid.NewGuid(),
            DeviceName = deviceName.Trim(),
            VoltagePhaseA = dto.VoltagePhaseA,
            VoltagePhaseB = dto.VoltagePhaseB,
            VoltagePhaseC = dto.VoltagePhaseC,
            CurrentPhaseA = dto.CurrentPhaseA,
            CurrentPhaseB = dto.CurrentPhaseB,
            CurrentPhaseC = dto.CurrentPhaseC,
            ActivePower = dto.ActivePower,
            Frequency = dto.Frequency,
            CreatedAt = DateTime.UtcNow,
        };

        _context.MeterReadings.Add(reading);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(reading.Id, 201);
    }

    public async Task<ApiResult<IEnumerable<MeterDataResponseDto>>> GetLatestAsync(string? deviceName, int take)
    {
        take = take is <= 0 or > 1000 ? 100 : take;

        var query = _context.MeterReadings.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(deviceName))
            query = query.Where(r => r.DeviceName == deviceName.Trim());

        var readings = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(take)
            .Select(r => new MeterDataResponseDto
            {
                Id = r.Id,
                DeviceName = r.DeviceName,
                VoltagePhaseA = r.VoltagePhaseA,
                VoltagePhaseB = r.VoltagePhaseB,
                VoltagePhaseC = r.VoltagePhaseC,
                CurrentPhaseA = r.CurrentPhaseA,
                CurrentPhaseB = r.CurrentPhaseB,
                CurrentPhaseC = r.CurrentPhaseC,
                ActivePower = r.ActivePower,
                Frequency = r.Frequency,
                CreatedAt = r.CreatedAt,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<MeterDataResponseDto>>.Success(readings);
    }

    public async Task<ApiResult<IEnumerable<string>>> GetDevicesAsync()
    {
        var devices = await _context.MeterReadings
            .AsNoTracking()
            .Select(r => r.DeviceName)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();

        return ApiResult<IEnumerable<string>>.Success(devices);
    }
}
