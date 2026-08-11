using Application.DTOs;
using Application.DTOs.Energy;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class EnergyTariffService : IEnergyTariffService
{
    private readonly DatabaseContext _context;

    public EnergyTariffService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<EnergyTariffDto>>> GetAllAsync()
    {
        var tariffs = await _context.EnergyTariffs
            .AsNoTracking()
            .OrderByDescending(t => t.EffectiveFrom)
            .Select(t => new EnergyTariffDto
            {
                Id = t.Id,
                PricePerKwh = t.PricePerKwh,
                Currency = t.Currency,
                EffectiveFrom = t.EffectiveFrom,
                Note = t.Note,
                CreatedAt = t.CreatedAt,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByName = _context.Users
                    .Where(u => u.Id == t.CreatedByUserId)
                    .Select(u => u.LastName + " " + u.FirstName)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<EnergyTariffDto>>.Success(tariffs);
    }

    public async Task<ApiResult<Guid>> CreateAsync(EnergyTariffSaveDto dto, Guid userId)
    {
        var validation = Validate(dto);
        if (validation is not null)
            return ApiResult<Guid>.Failure([validation], 400);

        var effectiveFrom = Normalize(dto.EffectiveFrom);

        if (await _context.EnergyTariffs.AnyAsync(t => t.EffectiveFrom == effectiveFrom))
            return ApiResult<Guid>.Failure(["Bu sanada tarif allaqachon mavjud."], 400);

        var tariff = new EnergyTariff
        {
            Id = Guid.NewGuid(),
            PricePerKwh = dto.PricePerKwh,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "so'm" : dto.Currency.Trim(),
            EffectiveFrom = effectiveFrom,
            Note = dto.Note?.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.EnergyTariffs.Add(tariff);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(tariff.Id, 201);
    }

    public async Task<ApiResult<bool>> UpdateAsync(Guid id, EnergyTariffSaveDto dto)
    {
        var validation = Validate(dto);
        if (validation is not null)
            return ApiResult<bool>.Failure([validation], 400);

        var tariff = await _context.EnergyTariffs.FirstOrDefaultAsync(t => t.Id == id);
        if (tariff is null)
            return ApiResult<bool>.Failure(["Tarif topilmadi."], 404);

        var effectiveFrom = Normalize(dto.EffectiveFrom);

        if (await _context.EnergyTariffs.AnyAsync(t => t.Id != id && t.EffectiveFrom == effectiveFrom))
            return ApiResult<bool>.Failure(["Bu sanada boshqa tarif mavjud."], 400);

        tariff.PricePerKwh = dto.PricePerKwh;
        tariff.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "so'm" : dto.Currency.Trim();
        tariff.EffectiveFrom = effectiveFrom;
        tariff.Note = dto.Note?.Trim();

        await _context.SaveChangesAsync();
        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> DeleteAsync(Guid id)
    {
        var tariff = await _context.EnergyTariffs.FirstOrDefaultAsync(t => t.Id == id);
        if (tariff is null)
            return ApiResult<bool>.Failure(["Tarif topilmadi."], 404);

        // Kamida bitta tarif qolishi shart — aks holda xarajat hisoblab bo'lmaydi.
        if (await _context.EnergyTariffs.CountAsync() <= 1)
            return ApiResult<bool>.Failure(["Oxirgi tarifni o'chirib bo'lmaydi."], 400);

        _context.EnergyTariffs.Remove(tariff);
        await _context.SaveChangesAsync();

        return ApiResult<bool>.Success(true);
    }

    private static string? Validate(EnergyTariffSaveDto dto)
    {
        if (dto.PricePerKwh <= 0)
            return "Narx noldan katta bo'lishi kerak.";

        if (dto.EffectiveFrom == default)
            return "Amal qilish sanasi ko'rsatilmagan.";

        return null;
    }

    /// <summary>Sanani UTC kun boshiga keltiradi — tarif kun aniqligida amal qiladi.</summary>
    private static DateTime Normalize(DateTime value) =>
        DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
}
