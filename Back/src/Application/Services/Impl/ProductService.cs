using Application.DTOs;
using Application.DTOs.Products;
using Core.Entities;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ProductService : IProductService
{
    private readonly DatabaseContext _context;

    public ProductService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<ProductResponseDto>>> GetAllAsync()
    {
        var products = await _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<ProductResponseDto>>.Success(products.Select(MapToResponse));
    }

    public async Task<ApiResult<IEnumerable<ProductResponseDto>>> GetByDepartmentAsync(Guid departmentId)
    {
        var products = await _context.Products
            .Include(p => p.Department)
            .Where(p => p.DepartmentId == departmentId)
            .AsNoTracking()
            .ToListAsync();

        return ApiResult<IEnumerable<ProductResponseDto>>.Success(products.Select(MapToResponse));
    }

    public async Task<ApiResult<ProductResponseDto>> GetByIdAsync(Guid id)
    {
        var product = await _context.Products
            .Include(p => p.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<ProductResponseDto>.Failure([$"Product with id '{id}' not found."]);

        return ApiResult<ProductResponseDto>.Success(MapToResponse(product));
    }

    public async Task<ApiResult<int>> CreateAsync(ProductCreateDto dto)
    {
        if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

        if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == dto.DepartmentId))
            return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            DepartmentId = dto.DepartmentId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> CreateBulkAsync(IEnumerable<ProductCreateDto> dtos)
    {
        var list = dtos.ToList();

        if (list.Count > 200)
            return ApiResult<int>.Failure(["Bir vaqtda 200 tadan ortiq mahsulot qo'shib bo'lmaydi."]);

        foreach (var dto in list)
        {
            if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId))
                return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

            if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == dto.DepartmentId))
                return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);
        }

        var products = list.Select(dto => new Product
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            DepartmentId = dto.DepartmentId,
            CreatedAt = DateTime.UtcNow
        });

        await _context.Products.AddRangeAsync(products);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ProductUpdateDto dto)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<int>.Failure([$"Product with id '{id}' not found."]);

        if (dto.DepartmentId.HasValue && dto.DepartmentId.Value != product.DepartmentId)
        {
            if (!await _context.Departments.AnyAsync(d => d.Id == dto.DepartmentId.Value))
                return ApiResult<int>.Failure([$"Department with id '{dto.DepartmentId}' not found."]);

            product.DepartmentId = dto.DepartmentId.Value;
        }

        if (dto.Name is not null && dto.Name != product.Name)
        {
            var deptId = dto.DepartmentId ?? product.DepartmentId;
            if (await _context.Products.AnyAsync(p => p.Name == dto.Name && p.DepartmentId == deptId))
                return ApiResult<int>.Failure([$"Product with name '{dto.Name}' already exists in this department."]);

            product.Name = dto.Name;
        }

        if (dto.Description is not null) product.Description = dto.Description;
        if (dto.Quantity.HasValue) product.Quantity = dto.Quantity.Value;
        if (dto.Unit.HasValue) product.Unit = dto.Unit.Value;

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return ApiResult<int>.Failure([$"Product with id '{id}' not found."]);

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    private static ProductResponseDto MapToResponse(Product product) => new()
    {
        Id = product.Id,
        Name = product.Name,
        Description = product.Description,
        Quantity = product.Quantity,
        Unit = product.Unit,
        DepartmentId = product.DepartmentId,
        DepartmentName = product.Department?.Name ?? string.Empty,
        CreatedAt = product.CreatedAt
    };
}
