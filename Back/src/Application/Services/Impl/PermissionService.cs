using Application.DTOs;
using Application.DTOs.Permissions;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class PermissionService : IPermissionService
{
    private readonly DatabaseContext _context;

    public PermissionService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<PermissionResponseDto>>> GetAllAsync()
    {
        var permissions = await _context.Permissions
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<PermissionResponseDto>>.Success(permissions.Select(MapToResponse));
    }

    public async Task<ApiResult<PermissionResponseDto>> GetByIdAsync(Guid id)
    {
        var permission = await _context.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (permission is null)
            return ApiResult<PermissionResponseDto>.Failure([$"Permission with id '{id}' not found."], 404);

        return ApiResult<PermissionResponseDto>.Success(MapToResponse(permission));
    }

    public async Task<ApiResult<int>> CreateAsync(PermissionCreateDto dto)
    {
        if (await _context.Permissions.AnyAsync(p => p.Name == dto.Name))
            return ApiResult<int>.Failure([$"Permission with name '{dto.Name}' already exists."]);

        var permission = new Permission
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        _context.Permissions.Add(permission);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, PermissionUpdateDto dto)
    {
        var permission = await _context.Permissions.FirstOrDefaultAsync(p => p.Id == id);

        if (permission is null)
            return ApiResult<int>.Failure([$"Permission with id '{id}' not found."], 404);

        if (dto.Name is not null && dto.Name != permission.Name)
        {
            if (await _context.Permissions.AnyAsync(p => p.Name == dto.Name))
                return ApiResult<int>.Failure([$"Permission with name '{dto.Name}' already exists."]);

            permission.Name = dto.Name;
        }

        if (dto.Description is not null)
            permission.Description = dto.Description;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var permission = await _context.Permissions.FirstOrDefaultAsync(p => p.Id == id);

        if (permission is null)
            return ApiResult<int>.Failure([$"Permission with id '{id}' not found."], 404);

        _context.Permissions.Remove(permission);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static PermissionResponseDto MapToResponse(Permission permission) => new()
    {
        Id = permission.Id,
        Name = permission.Name,
        Description = permission.Description,
        CreatedAt = permission.CreatedAt
    };
}
