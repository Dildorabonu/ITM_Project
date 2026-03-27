using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class TechnicalDrawingService : ITechnicalDrawingService
{
    private readonly DatabaseContext _context;

    public TechnicalDrawingService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<TechnicalDrawingResponseDto>>> GetAllAsync(DrawingStatus? status = null)
    {
        var query = _context.TechnicalDrawings
            .Include(d => d.Contract)
            .Include(d => d.Creator)
            .AsNoTracking()
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(d => d.Status == status.Value);

        var list = await query.OrderByDescending(d => d.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<TechnicalDrawingResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<TechnicalDrawingResponseDto>> GetByIdAsync(Guid id)
    {
        var drawing = await _context.TechnicalDrawings
            .Include(d => d.Contract)
            .Include(d => d.Creator)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id);

        if (drawing is null)
            return ApiResult<TechnicalDrawingResponseDto>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        return ApiResult<TechnicalDrawingResponseDto>.Success(MapToResponse(drawing));
    }

    public async Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy)
    {
        var contractExists = await _context.Contracts.AnyAsync(c => c.Id == dto.ContractId);
        if (!contractExists)
            return ApiResult<Guid>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."]);

        var drawing = new TechnicalDrawing
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            Title = dto.Title,
            Notes = dto.Notes,
            Status = DrawingStatus.Draft,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.TechnicalDrawings.Add(drawing);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(drawing.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, TechnicalDrawingUpdateDto dto)
    {
        var drawing = await _context.TechnicalDrawings.FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        if (dto.Title is not null) drawing.Title = dto.Title;
        if (dto.Notes is not null) drawing.Notes = dto.Notes;

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> UpdateStatusAsync(Guid id, DrawingStatus status)
    {
        var drawing = await _context.TechnicalDrawings.FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        drawing.Status = status;
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var drawing = await _context.TechnicalDrawings.FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        _context.TechnicalDrawings.Remove(drawing);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    private static TechnicalDrawingResponseDto MapToResponse(TechnicalDrawing d) => new()
    {
        Id = d.Id,
        ContractId = d.ContractId,
        ContractNo = d.Contract?.ContractNo ?? "",
        ClientName = d.Contract?.ClientName ?? "",
        Title = d.Title,
        Notes = d.Notes,
        Status = d.Status,
        CreatedBy = d.CreatedBy,
        CreatedByFullName = d.Creator is not null ? $"{d.Creator.FirstName} {d.Creator.LastName}" : null,
        CreatedAt = d.CreatedAt,
    };
}
