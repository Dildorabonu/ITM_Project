using Application.DTOs;
using Application.DTOs.Permissions;
using Application.Extensions;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Application.Services.Impl;

public class PermissionService : IPermissionService
{
    private readonly DatabaseContext _context;
    private readonly IMemoryCache _cache;

    private const string GroupedCacheKey = "permissions_grouped";

    // Permission qatorlari faqat startupdagi seed paytida o'zgaradi (AutomatedMigration),
    // shuning uchun tayyor javob xotirada saqlanadi — har so'rovda DB ham, reflection ham ishlamaydi.
    private static readonly TimeSpan GroupedCacheTtl = TimeSpan.FromHours(1);

    // Entity emas, faqat kerakli 3 ta ustun o'qiladi; so'rov startupda bir marta tarjima qilinadi.
    private static readonly Func<DatabaseContext, IAsyncEnumerable<PermissionRow>> CompiledRows =
        EF.CompileAsyncQuery((DatabaseContext db) =>
            db.Permissions
              .AsNoTracking()
              .OrderBy(p => p.Module).ThenBy(p => p.Action)
              .Select(p => new PermissionRow
              {
                  Id = p.Id,
                  Module = p.Module,
                  Action = p.Action,
              }));

    public PermissionService(DatabaseContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<ApiResult<IEnumerable<PermissionModuleResponseDto>>> GetAllGroupedAsync()
    {
        if (!_cache.TryGetValue(GroupedCacheKey, out PermissionModuleResponseDto[]? grouped) || grouped is null)
        {
            var rows = new List<PermissionRow>();
            await foreach (var row in CompiledRows(_context))
                rows.Add(row);

            // Qatorlar Module/Action bo'yicha bazadan tartiblangan holda keladi,
            // GroupBy esa shu tartibni saqlaydi — qo'shimcha saralash kerak emas.
            grouped = rows
                .GroupBy(p => p.Module)
                .Select(g => new PermissionModuleResponseDto
                {
                    Module = g.Key.ToString(),
                    ModuleName = g.Key.GetDisplayName(),
                    Actions = g.Select(p => new PermissionResponseDto
                    {
                        Id = p.Id,
                        Action = p.Action.ToString(),
                        ActionName = p.Action.GetDisplayName(),
                    }).ToList()
                })
                .ToArray();

            _cache.Set(GroupedCacheKey, grouped, GroupedCacheTtl);
        }

        return ApiResult<IEnumerable<PermissionModuleResponseDto>>.Success(grouped);
    }

    private sealed class PermissionRow
    {
        public Guid Id { get; init; }
        public PermissionModule Module { get; init; }
        public PermissionAction Action { get; init; }
    }
}
