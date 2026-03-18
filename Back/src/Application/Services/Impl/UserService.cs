using Application.DTOs;
using Application.DTOs.Users;
using Application.Helpers;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class UserService : IUserService
{
    private readonly DatabaseContext _context;

    public UserService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<UserResponseDto>>> GetAllAsync()
    {
        var users = await _context.Users
            .Include(u => u.Role)
            .Include(u => u.Department)
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<UserResponseDto>>.Success(users.Select(MapToResponse));
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

    public async Task<ApiResult<int>> CreateAsync(UserCreateDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Login == dto.Login))
            return ApiResult<int>.Failure([$"Login '{dto.Login}' is already taken."]);

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Login = dto.Login,
            PasswordHash = PasswordHelper.HashPassword(dto.Password),
            RoleId = dto.RoleId,
            DepartmentId = dto.DepartmentId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, UserUpdateDto dto)
    {
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
        if (dto.Password is not null) user.PasswordHash = PasswordHelper.HashPassword(dto.Password);
        if (dto.RoleId.HasValue) user.RoleId = dto.RoleId;
        if (dto.DepartmentId.HasValue) user.DepartmentId = dto.DepartmentId;
        if (dto.IsActive.HasValue) user.IsActive = dto.IsActive.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return ApiResult<int>.Failure([$"User with id '{id}' not found."]);

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

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
        CreatedAt = user.CreatedAt
    };

}
