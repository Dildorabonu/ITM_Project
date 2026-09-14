using Application.DTOs;
using Application.DTOs.Departments;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
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

    // Dropdown/select uchun — faqat aktiv bo'limlar va faqat uchta maydon.
    public async Task<ApiResult<IEnumerable<DepartmentLookupDto>>> GetLookupAsync()
    {
        var departments = await _context.Departments
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentLookupDto
            {
                Id = d.Id,
                Name = d.Name,
                Type = d.Type,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<DepartmentLookupDto>>.Success(departments);
    }

    public async Task<ApiResult<PagedResult<DepartmentResponseDto>>> GetPagedAsync(
        PaginationParams pagination,
        string? search = null,
        DepartmentType? type = null)
    {
        var query = _context.Departments.AsNoTracking();

        if (type.HasValue)
            query = query.Where(d => d.Type == type.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(lower));
        }

        var totalCount = await query.CountAsync();

        // Bo'lim boshlig'i korrelyatsiyalangan subquery bilan olinadi — Users
        // jadvaliga alohida borish shart emas, bitta so'rov yetarli.
        var departments = await query
            .OrderBy(d => d.Name)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(d => new DepartmentResponseDto
            {
                Id = d.Id,
                Name = d.Name,
                Type = d.Type,
                EmployeeCount = d.EmployeeCount,
                IsActive = d.IsActive,
                HeadUserName = _context.Users
                    .Where(u => u.DepartmentId == d.Id && u.IsHead)
                    .Select(u => u.FirstName + " " + u.LastName)
                    .FirstOrDefault(),
            })
            .ToListAsync();

        var paged = PagedResult<DepartmentResponseDto>.Create(departments, totalCount, pagination);

        return ApiResult<PagedResult<DepartmentResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<int>> CreateAsync(DepartmentCreateDto dto)
    {
        if (await _context.Departments.AnyAsync(d => d.Name == dto.Name))
            return ApiResult<int>.Failure([$"Department with name '{dto.Name}' already exists."]);

        var department = new Department
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Type = dto.Type,
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

        if (dto.Type.HasValue) department.Type = dto.Type.Value;
        if (dto.EmployeeCount.HasValue) department.EmployeeCount = dto.EmployeeCount.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    // Aktiv/noaktiv toggle — entity'ni o'qimasdan bitta UPDATE bilan.
    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var affected = await _context.Departments
            .Where(d => d.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.IsActive, d => !d.IsActive));

        if (affected == 0)
            return ApiResult<int>.Failure([$"Department with id '{id}' not found."]);

        return ApiResult<int>.Success(200);
    }
}
