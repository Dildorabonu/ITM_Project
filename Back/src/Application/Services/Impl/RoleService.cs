using Application.DTOs;
using Application.DTOs.Roles;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class RoleService : IRoleService
{
    private readonly DatabaseContext _context;

    public RoleService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<RoleResponseDto>>> GetAllAsync()
    {
        var roles = await _context.Roles
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<RoleResponseDto>>.Success(roles.Select(MapToResponse));
    }

    public async Task<ApiResult<RoleResponseDto>> GetByIdAsync(Guid id)
    {
        var role = await _context.Roles
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return ApiResult<RoleResponseDto>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        return ApiResult<RoleResponseDto>.Success(MapToResponse(role));
    }

    public async Task<ApiResult<object>> CreateAsync(RoleCreateDto dto)
    {
        if (await _context.Roles.AnyAsync(r => r.Name == dto.Name))
            return ApiResult<object>.Failure([$"Role with name '{dto.Name}' already exists."]);

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        _context.Roles.Add(role);
        await _context.SaveChangesAsync();

        return ApiResult<object>.Success(statusCode: 201);
    }

    public async Task<ApiResult<object>> UpdateAsync(Guid id, RoleUpdateDto dto)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return ApiResult<object>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        if (dto.Name is not null && dto.Name != role.Name)
        {
            if (await _context.Roles.AnyAsync(r => r.Name == dto.Name))
                return ApiResult<object>.Failure([$"Role with name '{dto.Name}' already exists."]);

            role.Name = dto.Name;
        }

        if (dto.Description is not null) role.Description = dto.Description;

        await _context.SaveChangesAsync();

        return ApiResult<object>.Success();
    }

    public async Task<ApiResult<object>> DeleteAsync(Guid id)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id);

        if (role is null)
            return ApiResult<object>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        _context.Roles.Remove(role);
        await _context.SaveChangesAsync();

        return ApiResult<object>.Success();
    }

    private static RoleResponseDto MapToResponse(Role role) => new()
    {
        Id = role.Id,
        Name = role.Name,
        Description = role.Description,
        CreatedAt = role.CreatedAt
    };
}
