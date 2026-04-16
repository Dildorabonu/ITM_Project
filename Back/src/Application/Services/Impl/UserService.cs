using Application.DTOs;
using Application.DTOs.Users;
using Application.Helpers;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Application.Services.Impl;

public class UserService : IUserService
{
    private readonly DatabaseContext _context;
    private readonly IMemoryCache _cache;
    private const string LookupCacheKey = "user_lookup";

    // Compiled once at startup — EF Core does not re-translate this query on every call
    private static readonly Func<DatabaseContext, IAsyncEnumerable<UserLookupDto>> CompiledLookup =
        EF.CompileAsyncQuery((DatabaseContext db) =>
            db.Users
              .AsNoTracking()
              .Where(u => u.IsActive)
              .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
              .Select(u => new UserLookupDto
              {
                  Id             = u.Id,
                  FirstName      = u.FirstName,
                  LastName       = u.LastName,
                  DepartmentId   = u.Department != null ? (Guid?)u.Department.Id : null,
                  DepartmentName = u.Department != null ? u.Department.Name : null,
                  DepartmentType = u.Department != null ? (Core.Enums.DepartmentType?)u.Department.Type : null,
              }));

    public UserService(DatabaseContext context, IMemoryCache cache)
    {
        _context = context;
        _cache   = cache;
    }

    public async Task<ApiResult<PagedResult<UserResponseDto>>> GetAllAsync(PaginationParams pagination)
    {
        var query = _context.Users
            .Include(u => u.Role)
            .Include(u => u.Department)
            .AsNoTracking()
            .OrderBy(u => u.FirstName);

        var totalCount = await query.CountAsync();
        var users = await query
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var paged = PagedResult<UserResponseDto>.Create(users.Select(MapToResponse), totalCount, pagination);

        return ApiResult<PagedResult<UserResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<IEnumerable<UserLookupDto>>> GetLookupAsync()
    {
        if (_cache.TryGetValue(LookupCacheKey, out List<UserLookupDto>? cached))
            return ApiResult<IEnumerable<UserLookupDto>>.Success(cached!);

        var users = new List<UserLookupDto>();
        await foreach (var u in CompiledLookup(_context))
            users.Add(u);

        _cache.Set(LookupCacheKey, users, TimeSpan.FromMinutes(5));

        return ApiResult<IEnumerable<UserLookupDto>>.Success(users);
    }

    public async Task<ApiResult<UserResponseDto>> GetByIdAsync(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return ApiResult<UserResponseDto>.Failure([$"User with id '{id}' not found."]);

        return ApiResult<UserResponseDto>.Success(MapToResponse(user));
    }

    private static bool IsPasswordStrong(string password) =>
        password.Length >= 8 &&
        password.Any(char.IsUpper) &&
        password.Any(char.IsLower) &&
        password.Any(char.IsDigit) &&
        password.Any(c => !char.IsLetterOrDigit(c));

    public async Task<ApiResult<int>> CreateAsync(UserCreateDto dto)
    {
        if (!IsPasswordStrong(dto.Password))
            return ApiResult<int>.Failure(["Parol yetarlicha kuchli emas. Kamida 8 ta belgi, katta va kichik harf, raqam va maxsus belgi bo'lishi kerak."]);

        if (await _context.Users.AnyAsync(u => u.Login == dto.Login))
            return ApiResult<int>.Failure([$"Login '{dto.Login}' is already taken."]);

        if (dto.IsHead && dto.DepartmentId.HasValue)
        {
            var previousHead = await _context.Users
                .Where(u => u.DepartmentId == dto.DepartmentId && u.IsHead)
                .FirstOrDefaultAsync();
            if (previousHead is not null)
                return ApiResult<int>.Failure([$"Ushbu bo'limda allaqachon rahbar mavjud: {previousHead.FirstName} {previousHead.LastName}. Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang."]);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Login = dto.Login,
            PasswordHash = PasswordHelper.HashPassword(dto.Password),
            RoleId = dto.RoleId,
            DepartmentId = dto.DepartmentId,
            IsHead = dto.IsHead,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(201);
    }

    private static readonly Guid SuperAdminId = new("00000000-0000-0000-0000-000000000001");

    public async Task<ApiResult<int>> UpdateAsync(Guid id, UserUpdateDto dto)
    {
        if (id == SuperAdminId)
            return ApiResult<int>.Failure(["SuperAdmin foydalanuvchisini tahrirlash mumkin emas."], statusCode: 403);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return ApiResult<int>.Failure([$"User with id '{id}' not found."]);

        if (dto.Login is not null && dto.Login != user.Login)
        {
            if (await _context.Users.AnyAsync(u => u.Login == dto.Login))
                return ApiResult<int>.Failure([$"Login '{dto.Login}' is already taken."]);

            user.Login = dto.Login;
        }

        if (dto.FirstName is not null) user.FirstName = dto.FirstName;
        if (dto.LastName is not null) user.LastName = dto.LastName;
        if (dto.Password is not null)
        {
            if (!IsPasswordStrong(dto.Password))
                return ApiResult<int>.Failure(["Parol yetarlicha kuchli emas. Kamida 8 ta belgi, katta va kichik harf, raqam va maxsus belgi bo'lishi kerak."]);
            user.PasswordHash = PasswordHelper.HashPassword(dto.Password);
        }
        if (dto.RoleId.HasValue) user.RoleId = dto.RoleId;
        if (dto.DepartmentId.HasValue) user.DepartmentId = dto.DepartmentId;
        if (dto.IsActive.HasValue)
        {
            user.IsActive = dto.IsActive.Value;
            if (!dto.IsActive.Value)
                user.IsHead = false;
        }

        if (dto.IsHead.HasValue)
        {
            if (dto.IsHead.Value && user.DepartmentId.HasValue)
            {
                var previousHead = await _context.Users
                    .Where(u => u.DepartmentId == user.DepartmentId && u.IsHead && u.Id != id)
                    .FirstOrDefaultAsync();
                if (previousHead is not null)
                    return ApiResult<int>.Failure([$"Ushbu bo'limda allaqachon rahbar mavjud: {previousHead.FirstName} {previousHead.LastName}. Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang."]);
            }
            user.IsHead = dto.IsHead.Value;
        }

        await _context.SaveChangesAsync();
        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        if (id == SuperAdminId)
            return ApiResult<int>.Failure(["SuperAdmin foydalanuvchisini o'chirish mumkin emas."], statusCode: 403);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return ApiResult<int>.Failure([$"User with id '{id}' not found."]);

        user.IsActive = false;
        user.IsHead = false;
        await _context.SaveChangesAsync();
        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(200);
    }

    private static UserResponseDto MapToResponse(User user) => new()
    {
        Id = user.Id,
        FirstName = user.FirstName,
        LastName = user.LastName,
        Login = user.Login,
        RoleId = user.RoleId,
        RoleName = user.Role?.Name,
        DepartmentId = user.DepartmentId,
        DepartmentName = user.Department?.Name,
        IsActive = user.IsActive,
        IsHead = user.IsHead,
        CreatedAt = user.CreatedAt
    };

}
