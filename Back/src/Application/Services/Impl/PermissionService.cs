using Application.DTOs;
using Application.DTOs.Permissions;
using Application.Extensions;
using Core.Enums;
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

    public async Task<ApiResult<IEnumerable<PermissionModuleResponseDto>>> GetAllGroupedAsync()
    {
        var permissions = await _context.Permissions
            .AsNoTracking()
            .ToListAsync();

        var grouped = permissions
            .GroupBy(p => p.Module)
            .OrderBy(g => (int)g.Key)
            .Select(g => new PermissionModuleResponseDto
            {
                Module = g.Key.ToString(),
                ModuleName = g.Key.GetDisplayName(),
                ModuleIcon = g.Key.GetDisplayIcon(),
                Actions = g.OrderBy(p => (int)p.Action).Select(p => new PermissionResponseDto
                {
                    Id = p.Id,
                    Action = p.Action.ToString(),
                    ActionName = p.Action.GetDisplayName(),
                    ActionIcon = p.Action.GetDisplayIcon(),
                }).ToList()
            });

        return ApiResult<IEnumerable<PermissionModuleResponseDto>>.Success(grouped);
    }

    public async Task<ApiResult<PermissionResponseDto>> GetByIdAsync(Guid id)
    {
        var permission = await _context.Permissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (permission is null)
            return ApiResult<PermissionResponseDto>.Failure([$"Permission with id '{id}' not found."], 404);

        return ApiResult<PermissionResponseDto>.Success(new PermissionResponseDto
        {
            Id = permission.Id,
            Action = permission.Action.ToString(),
            ActionName = permission.Action.GetDisplayName(),
            ActionIcon = permission.Action.GetDisplayIcon(),
        });
    }
}
