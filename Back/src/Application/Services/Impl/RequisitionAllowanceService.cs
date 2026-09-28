using Application.DTOs;
using Application.DTOs.Requisitions;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class RequisitionAllowanceService : IRequisitionAllowanceService
{
    private const decimal MaxPercent = 20m;
    private const int NoteMaxLength = 500;

    private readonly DatabaseContext _context;

    public RequisitionAllowanceService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<RequisitionAllowanceRateDto>>> GetAllAsync()
    {
        var rates = await _context.RequisitionAllowanceRates
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new RequisitionAllowanceRateDto
            {
                Id = r.Id,
                Percent = r.Percent,
                Note = r.Note,
                CreatedAt = r.CreatedAt,
                CreatedByName = _context.Users
                    .Where(u => u.Id == r.CreatedByUserId)
                    .Select(u => u.LastName + " " + u.FirstName)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<RequisitionAllowanceRateDto>>.Success(rates);
    }

    public async Task<decimal> GetCurrentPercentAsync() =>
        await _context.RequisitionAllowanceRates
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => (decimal?)r.Percent)
            .FirstOrDefaultAsync() ?? 0m;

    public async Task<ApiResult<Guid>> CreateAsync(RequisitionAllowanceSaveDto dto, Guid userId)
    {
        if (dto.Percent < 0 || dto.Percent > MaxPercent)
            return ApiResult<Guid>.Failure(["Zaxira foizi 0 dan 20 gacha bo'lishi kerak."]);

        if (decimal.Round(dto.Percent, 2) != dto.Percent)
            return ApiResult<Guid>.Failure(["Zaxira foizi ko'pi bilan 2 xonali kasr bo'lishi mumkin."]);

        var note = dto.Note?.Trim();
        if (note?.Length > NoteMaxLength)
            return ApiResult<Guid>.Failure(["Izoh 500 belgidan oshmasligi kerak."]);

        if (dto.Percent == await GetCurrentPercentAsync())
            return ApiResult<Guid>.Failure(["Zaxira foizi o'zgarmagan."]);

        var rate = new RequisitionAllowanceRate
        {
            Id = Guid.NewGuid(),
            Percent = dto.Percent,
            Note = string.IsNullOrEmpty(note) ? null : note,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
        };

        _context.RequisitionAllowanceRates.Add(rate);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(rate.Id, 201);
    }
}
