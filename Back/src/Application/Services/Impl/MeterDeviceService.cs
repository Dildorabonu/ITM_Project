using Application.DTOs;
using Application.DTOs.Energy;
using Application.Helpers;
using Application.Options;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class MeterDeviceService : IMeterDeviceService
{
    private readonly DatabaseContext _context;
    private readonly MeterDeviceSignal _signal;

    public MeterDeviceService(DatabaseContext context, MeterDeviceSignal signal)
    {
        _context = context;
        _signal = signal;
    }

    public async Task<ApiResult<IEnumerable<MeterDeviceDto>>> GetAllAsync()
    {
        var devices = await _context.MeterDevices
            .AsNoTracking()
            .Where(d => d.DeletedAt == null)
            .OrderBy(d => d.Name)
            .Select(d => new MeterDeviceDto
            {
                Id = d.Id,
                Name = d.Name,
                Ip = d.Ip,
                Port = d.Port,
                SlaveId = d.SlaveId,
                StartAddress = d.StartAddress,
                RegisterCount = d.RegisterCount,
                PtRatio = d.PtRatio,
                IntervalSeconds = d.IntervalSeconds,
                Enabled = d.Enabled,
                CreatedAt = d.CreatedAt,
                HasReadings =
                    _context.MeterReadings.Any(r => r.DeviceName == d.Name) ||
                    _context.MeterEnergyHourly.Any(r => r.DeviceName == d.Name),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<MeterDeviceDto>>.Success(devices);
    }

    public async Task<ApiResult<Guid>> CreateAsync(MeterDeviceSaveDto dto)
    {
        var validation = MeterDeviceValidator.Validate(dto);
        if (validation is not null)
            return ApiResult<Guid>.Failure([validation], 400);

        var name = dto.Name.Trim();
        var ip = dto.Ip.Trim();

        var conflict = await FindConflictAsync(null, name, ip, dto.Port, dto.SlaveId);
        if (conflict is not null)
            return ApiResult<Guid>.Failure([conflict], 400);

        var device = new MeterDevice
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        Apply(device, dto, name, ip);

        _context.MeterDevices.Add(device);
        await _context.SaveChangesAsync();
        _signal.Notify();

        return ApiResult<Guid>.Success(device.Id, 201);
    }

    public async Task<ApiResult<bool>> UpdateAsync(Guid id, MeterDeviceSaveDto dto)
    {
        var validation = MeterDeviceValidator.Validate(dto);
        if (validation is not null)
            return ApiResult<bool>.Failure([validation], 400);

        var device = await _context.MeterDevices.FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);
        if (device is null)
            return ApiResult<bool>.Failure(["Qurilma topilmadi."], 404);

        var name = dto.Name.Trim();
        var ip = dto.Ip.Trim();

        // O'lchovlar qurilmaga nomi orqali bog'langan: ma'lumot kelgandan keyin
        // nom o'zgarsa tarix eski nom ostida alohida "qurilma" bo'lib qolardi.
        if (name != device.Name && await HasReadingsAsync(device.Name))
            return ApiResult<bool>.Failure(["Qurilma ma'lumot yuborgan — nomini o'zgartirib bo'lmaydi."], 400);

        var conflict = await FindConflictAsync(id, name, ip, dto.Port, dto.SlaveId);
        if (conflict is not null)
            return ApiResult<bool>.Failure([conflict], 400);

        Apply(device, dto, name, ip);
        device.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        _signal.Notify();

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> DeleteAsync(Guid id)
    {
        var device = await _context.MeterDevices.FirstOrDefaultAsync(d => d.Id == id && d.DeletedAt == null);
        if (device is null)
            return ApiResult<bool>.Failure(["Qurilma topilmadi."], 404);

        device.DeletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        _signal.Notify();

        return ApiResult<bool>.Success(true);
    }

    public async Task<IReadOnlyList<MeterDeviceOptions>> GetPollTargetsAsync() =>
        await _context.MeterDevices
            .AsNoTracking()
            .Where(d => d.DeletedAt == null && d.Enabled)
            .OrderBy(d => d.Name)
            .Select(d => new MeterDeviceOptions
            {
                Id = d.Id,
                Name = d.Name,
                Ip = d.Ip,
                Port = d.Port,
                SlaveId = d.SlaveId,
                StartAddress = d.StartAddress,
                RegisterCount = d.RegisterCount,
                PtRatio = d.PtRatio,
                IntervalSeconds = d.IntervalSeconds,
                Enabled = true,
            })
            .ToListAsync();

    public async Task<int> ImportFromConfigAsync(IReadOnlyList<MeterDeviceOptions> devices)
    {
        // O'chirilgan qatorlar ham hisobga olinadi — aks holda hamma qurilmani
        // UI dan o'chirgan administrator restartdan keyin ularni qaytadan ko'rardi.
        if (devices.Count == 0 || await _context.MeterDevices.AnyAsync())
            return 0;

        var now = DateTime.UtcNow;

        // Nomsiz va bir xil IP li yozuvlar bitta nomga yechiladi; unique indeks
        // ikkinchisini qabul qilmaydi — birinchisi olinadi.
        var imported = devices
            .DistinctBy(d => d.Name, StringComparer.Ordinal)
            .Select(d => new MeterDevice
            {
                Id = Guid.NewGuid(),
                Name = d.Name,
                Ip = d.Ip,
                Port = d.Port,
                SlaveId = d.SlaveId,
                StartAddress = d.StartAddress,
                RegisterCount = d.RegisterCount,
                PtRatio = d.PtRatio,
                IntervalSeconds = d.IntervalSeconds,
                Enabled = true,
                CreatedAt = now,
            })
            .ToList();

        _context.MeterDevices.AddRange(imported);
        await _context.SaveChangesAsync();

        return imported.Count;
    }

    private async Task<bool> HasReadingsAsync(string name) =>
        await _context.MeterReadings.AnyAsync(r => r.DeviceName == name) ||
        await _context.MeterEnergyHourly.AnyAsync(r => r.DeviceName == name);

    private async Task<string?> FindConflictAsync(Guid? id, string name, string ip, int port, int slaveId)
    {
        var active = _context.MeterDevices.Where(d => d.DeletedAt == null);
        if (id is Guid self)
            active = active.Where(d => d.Id != self);

        if (await active.AnyAsync(d => d.Name == name))
            return "Bu nomdagi qurilma allaqachon mavjud.";

        var sameEndpoint = await active
            .Where(d => d.Ip == ip && d.Port == port && d.SlaveId == slaveId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync();

        return sameEndpoint is null
            ? null
            : $"Bu IP, port va Slave ID bilan qurilma allaqachon qo'shilgan: {sameEndpoint}.";
    }

    private static void Apply(MeterDevice device, MeterDeviceSaveDto dto, string name, string ip)
    {
        device.Name = name;
        device.Ip = ip;
        device.Port = dto.Port;
        device.SlaveId = dto.SlaveId;
        device.StartAddress = dto.StartAddress;
        device.RegisterCount = dto.RegisterCount;
        device.PtRatio = dto.PtRatio;
        device.IntervalSeconds = dto.IntervalSeconds;
        device.Enabled = dto.Enabled;
    }
}
