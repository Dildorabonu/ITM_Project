using Application.DTOs;
using Application.DTOs.Roles;
using Application.Helpers;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class RoleService : IRoleService
{
    private static readonly Guid SuperAdminRoleId = new("00000000-0000-0000-0000-000000000001");

    private readonly DatabaseContext _context;

    public RoleService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<PagedResult<RoleResponseDto>>> GetPagedAsync(PaginationParams pagination, string? search = null)
    {
        var query = _context.Roles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(r =>
                r.Name.ToLower().Contains(lower) ||
                (r.Description != null && r.Description.ToLower().Contains(lower)));
        }

        // Entity o'qilmaydi — javobga tushadigan 4 ta ustungina tanlanadi (CreatedAt keraksiz).
        var items = await query
            .OrderBy(r => r.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(r => new RoleResponseDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                IsActive = r.IsActive
            })
            .ToListAsync();

        // Birinchi sahifa to'lmagan bo'lsa jami son allaqachon ma'lum —
        // qo'shimcha COUNT so'rovi yuborilmaydi.
        var totalCount = pagination.Page == 1 && items.Count < pagination.PageSize
            ? items.Count
            : await query.CountAsync();

        return ApiResult<PagedResult<RoleResponseDto>>.Success(
            PagedResult<RoleResponseDto>.Create(items, totalCount, pagination));
    }

    public async Task<ApiResult<IEnumerable<RoleLookupDto>>> GetLookupAsync()
    {
        var roles = await _context.Roles
            .AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .Select(r => new RoleLookupDto { Id = r.Id, Name = r.Name })
            .ToListAsync();

        return ApiResult<IEnumerable<RoleLookupDto>>.Success(roles);
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

        return ApiResult<object>.Success(new { id = role.Id }, statusCode: 201);
    }

    public async Task<ApiResult<object>> UpdateAsync(Guid id, RoleUpdateDto dto)
    {
        if (id == SuperAdminRoleId)
            return ApiResult<object>.Failure(["SuperAdmin rolini tahrirlash mumkin emas."], statusCode: 403);

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
        if (dto.IsActive.HasValue) role.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();

        return ApiResult<object>.Success();
    }

    public async Task<ApiResult<object>> DeleteAsync(Guid id)
    {
        if (id == SuperAdminRoleId)
            return ApiResult<object>.Failure(["SuperAdmin rolini o'chirish mumkin emas."], statusCode: 403);

        // Rolga biriktirilgan foydalanuvchi qatorlarini yuklash shart emas — EXISTS yetarli.
        if (await _context.Users.AnyAsync(u => u.RoleId == id))
            return ApiResult<object>.Failure(["Bu rolga ega foydalanuvchi bor. Avval foydalanuvchilardan ushbu rolni olib tashlang."], statusCode: 400);

        // Entity o'qilmasdan bitta UPDATE; affected == 0 bo'lsa rol topilmagan.
        var affected = await _context.Roles
            .Where(r => r.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsActive, false));

        if (affected == 0)
            return ApiResult<object>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        return ApiResult<object>.Success();
    }

    public async Task<ApiResult<IEnumerable<Guid>>> GetPermissionsAsync(Guid id)
    {
        var permissionIds = await _context.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == id)
            .Select(rp => rp.PermissionId)
            .ToListAsync();

        // Rol mavjudligini alohida tekshirish faqat ro'yxat bo'sh chiqqanda kerak —
        // odatiy holatda bitta so'rov yetadi.
        if (permissionIds.Count == 0 && !await _context.Roles.AnyAsync(r => r.Id == id))
            return ApiResult<IEnumerable<Guid>>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        return ApiResult<IEnumerable<Guid>>.Success(permissionIds);
    }

    public async Task<ApiResult<object>> SetPermissionsAsync(Guid id, SetPermissionsDto dto)
    {
        if (id == SuperAdminRoleId)
            return ApiResult<object>.Failure(["SuperAdmin rolining ruxsatlarini o'zgartirish mumkin emas."], statusCode: 403);

        if (!await _context.Roles.AnyAsync(r => r.Id == id))
            return ApiResult<object>.Failure([$"Role with id '{id}' not found."], statusCode: 404);

        var permissionIds = dto.ActionIds.Distinct().ToArray();

        // DELETE + INSERT bitta tranzaksiyada: oraliqda xato bo'lsa eski ruxsatlar saqlanib qoladi.
        await using var tx = await _context.Database.BeginTransactionAsync();

        // Eski juftliklarni xotiraga yuklab, keyin o'chirish shart emas — bitta DELETE.
        await _context.RolePermissions
            .Where(rp => rp.RoleId == id)
            .ExecuteDeleteAsync();

        if (permissionIds.Length > 0)
        {
            _context.RolePermissions.AddRange(
                permissionIds.Select(permId => new RolePermission { RoleId = id, PermissionId = permId }));

            await _context.SaveChangesAsync();
        }

        await tx.CommitAsync();

        return ApiResult<object>.Success();
    }
}
