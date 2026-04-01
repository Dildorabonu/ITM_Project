using Application.DTOs;
using Application.DTOs.Contracts;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ContractService : IContractService
{
    private readonly DatabaseContext _context;

    public ContractService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ContractStatus? status = null, Guid? departmentId = null)
    {
        var query = _context.Contracts
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.ContractDepartments.Any(cd =>
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)));
        }

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (departmentId.HasValue)
            query = query.Where(c => c.ContractDepartments.Any(cd => cd.DepartmentId == departmentId.Value));

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractResponseDto>>.Success(contracts.Select(MapToResponse));
    }

    public async Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .Include(c => c.ContractUsers).ThenInclude(cu => cu.User).ThenInclude(u => u.Role)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<ContractResponseDto>.Failure([$"Contract with id '{id}' not found."], 404);

        return ApiResult<ContractResponseDto>.Success(MapToResponse(contract));
    }

    public async Task<ApiResult<Guid>> CreateAsync(ContractCreateDto dto, Guid createdBy)
    {
        if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo))
            return ApiResult<Guid>.Failure([$"Contract with number '{dto.ContractNo}' already exists."]);

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = dto.ContractNo,
            ProductType = dto.ProductType,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Priority = dto.Priority,
            ContractParty = dto.ContractParty,
            Status = ContractStatus.Draft,
            Notes = dto.Notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Contracts.Add(contract);

        foreach (var deptId in dto.DepartmentIds.Distinct())
        {
            _context.ContractDepartments.Add(new ContractDepartment
            {
                ContractId = contract.Id,
                DepartmentId = deptId,
            });
        }

        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(contract.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ContractUpdateDto dto)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        if (dto.ContractNo is not null && dto.ContractNo != contract.ContractNo)
        {
            if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo))
                return ApiResult<int>.Failure([$"Contract with number '{dto.ContractNo}' already exists."]);

            contract.ContractNo = dto.ContractNo;
        }

        if (dto.ProductType is not null) contract.ProductType = dto.ProductType;
        if (dto.Quantity.HasValue) contract.Quantity = dto.Quantity.Value;
        if (dto.Unit is not null) contract.Unit = dto.Unit;
        if (dto.StartDate.HasValue) contract.StartDate = dto.StartDate.Value;
        if (dto.EndDate.HasValue) contract.EndDate = dto.EndDate.Value;
        if (dto.Priority.HasValue) contract.Priority = dto.Priority.Value;
        if (dto.ContractParty is not null) contract.ContractParty = dto.ContractParty;
        if (dto.Notes is not null) contract.Notes = dto.Notes;

        if (dto.DepartmentIds is not null)
        {
            _context.ContractDepartments.RemoveRange(contract.ContractDepartments);
            foreach (var deptId in dto.DepartmentIds.Distinct())
            {
                _context.ContractDepartments.Add(new ContractDepartment
                {
                    ContractId = contract.Id,
                    DepartmentId = deptId,
                });
            }
        }

        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> UpdateStatusAsync(Guid id, ContractStatus status)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        contract.Status = status;
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        _context.Contracts.Remove(contract);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<IEnumerable<ContractUserDto>>> GetUsersAsync(Guid contractId)
    {
        var exists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!exists)
            return ApiResult<IEnumerable<ContractUserDto>>.Failure([$"Contract '{contractId}' not found."], 404);

        var users = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .Include(cu => cu.User).ThenInclude(u => u.Department)
            .AsNoTracking()
            .Select(cu => new ContractUserDto
            {
                UserId         = cu.UserId,
                FullName       = $"{cu.User.FirstName} {cu.User.LastName}",
                DepartmentName = cu.User.Department != null ? cu.User.Department.Name : null,
                Role           = cu.Role,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractUserDto>>.Success(users);
    }

    public async Task<ApiResult<int>> AssignUsersAsync(Guid contractId, List<ContractUserAssignItem> users)
    {
        var exists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!exists)
            return ApiResult<int>.Failure([$"Contract '{contractId}' not found."], 404);

        var existing = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .ToListAsync();

        foreach (var item in users.DistinctBy(u => u.UserId))
        {
            var ex = existing.FirstOrDefault(e => e.UserId == item.UserId);
            if (ex is null)
            {
                _context.ContractUsers.Add(new ContractUser
                {
                    ContractId = contractId,
                    UserId     = item.UserId,
                    Role       = item.Role,
                });
            }
            else
            {
                ex.Role = item.Role;
            }
        }

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> RemoveUserAsync(Guid contractId, Guid userId)
    {
        var row = await _context.ContractUsers
            .FirstOrDefaultAsync(cu => cu.ContractId == contractId && cu.UserId == userId);

        if (row is null)
            return ApiResult<int>.Failure(["Assignment not found."], 404);

        _context.ContractUsers.Remove(row);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<IEnumerable<ContractResponseDto>>> GetMyProductionTasksAsync(Guid userId)
    {
        var user = await _context.Users
            .Include(u => u.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
            return ApiResult<IEnumerable<ContractResponseDto>>.Failure(["User not found."], 404);

        if (user.Department is null || user.Department.Type != Core.Enums.DepartmentType.IshlabChiqarish)
            return ApiResult<IEnumerable<ContractResponseDto>>.Success(Enumerable.Empty<ContractResponseDto>());

        var contracts = await _context.ContractUsers
            .Where(cu => cu.UserId == userId)
            .Include(cu => cu.Contract).ThenInclude(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(cu => cu.Contract).ThenInclude(c => c.Creator)
            .Include(cu => cu.Contract).ThenInclude(c => c.ContractUsers).ThenInclude(cu2 => cu2.User).ThenInclude(u => u.Role)
            .AsNoTracking()
            .Select(cu => cu.Contract)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractResponseDto>>.Success(contracts.Select(MapToResponse));
    }

    private static ContractResponseDto MapToResponse(Contract contract) => new()
    {
        Id = contract.Id,
        ContractNo = contract.ContractNo,
        ProductType = contract.ProductType,
        Quantity = contract.Quantity,
        Unit = contract.Unit,
        StartDate = contract.StartDate,
        EndDate = contract.EndDate,
        Departments = contract.ContractDepartments
            .Where(cd => cd.Department is not null)
            .Select(cd => new ContractDepartmentDto
            {
                Id   = cd.Department.Id,
                Name = cd.Department.Name,
                Type = cd.Department.Type,
            }).ToList(),
        Priority = contract.Priority,
        ContractParty = contract.ContractParty,
        Status = contract.Status,
        Notes = contract.Notes,
        CreatedBy = contract.CreatedBy,
        CreatedByFullName = contract.Creator is not null
            ? $"{contract.Creator.FirstName} {contract.Creator.LastName}"
            : null,
        CreatedAt = contract.CreatedAt,
        AssignedUsers = contract.ContractUsers
            .Select(cu => new ContractUserDto
            {
                UserId         = cu.UserId,
                FullName       = $"{cu.User!.FirstName} {cu.User.LastName}",
                DepartmentName = cu.User.Department?.Name,
                Role           = cu.Role,
            }).ToList(),
    };
}
