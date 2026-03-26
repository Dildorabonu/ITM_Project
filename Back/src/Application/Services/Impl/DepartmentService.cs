using Application.DTOs;
using Application.DTOs.Departments;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class DepartmentService : IDepartmentService
{
    private readonly DatabaseContext _context;

    public DepartmentService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<DepartmentResponseDto>>> GetAllAsync()
    {
        var departments = await _context.Departments
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<DepartmentResponseDto>>.Success(departments.Select(MapToResponse));
    }

    public async Task<ApiResult<DepartmentResponseDto>> GetByIdAsync(Guid id)
    {
        var department = await _context.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department is null)
            return ApiResult<DepartmentResponseDto>.Failure([$"Department with id '{id}' not found."]);

        return ApiResult<DepartmentResponseDto>.Success(MapToResponse(department));
    }

    public async Task<ApiResult<int>> CreateAsync(DepartmentCreateDto dto)
    {
        if (await _context.Departments.AnyAsync(d => d.Name == dto.Name))
            return ApiResult<int>.Failure([$"Department with name '{dto.Name}' already exists."]);

        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            EmployeeCount = dto.EmployeeCount,
            CreatedAt = DateTime.UtcNow
        };

        _context.Departments.Add(department);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, DepartmentUpdateDto dto)
    {
        var department = await _context.Departments.FirstOrDefaultAsync(d => d.Id == id);

        if (department is null)
            return ApiResult<int>.Failure([$"Department with id '{id}' not found."]);

        if (dto.Name is not null && dto.Name != department.Name)
        {
            if (await _context.Departments.AnyAsync(d => d.Name == dto.Name))
                return ApiResult<int>.Failure([$"Department with name '{dto.Name}' already exists."]);

            department.Name = dto.Name;
        }

        if (dto.EmployeeCount.HasValue) department.EmployeeCount = dto.EmployeeCount.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var department = await _context.Departments.FirstOrDefaultAsync(d => d.Id == id);

        if (department is null)
            return ApiResult<int>.Failure([$"Department with id '{id}' not found."]);

        _context.Departments.Remove(department);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static DepartmentResponseDto MapToResponse(Department department) => new()
    {
        Id = department.Id,
        Name = department.Name,
        EmployeeCount = department.EmployeeCount,
        CreatedAt = department.CreatedAt
    };
}
