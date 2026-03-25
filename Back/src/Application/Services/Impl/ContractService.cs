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

    public async Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(ContractStatus? status = null, Guid? departmentId = null)
    {
        var query = _context.Contracts
            .Include(c => c.Department)
            .Include(c => c.Creator)
            .AsNoTracking()
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (departmentId.HasValue)
            query = query.Where(c => c.DepartmentId == departmentId.Value);

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return ApiResult<IEnumerable<ContractResponseDto>>.Success(contracts.Select(MapToResponse));
    }

    public async Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.Department)
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
            ClientName = dto.ClientName,
            ProductType = dto.ProductType,
            Quantity = dto.Quantity,
            Unit = dto.Unit,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            DepartmentId = dto.DepartmentId,
            Priority = dto.Priority,
            ContractParty = dto.ContractParty,
            Status = ContractStatus.Draft,
            Notes = dto.Notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Contracts.Add(contract);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(contract.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, ContractUpdateDto dto)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        if (dto.ContractNo is not null && dto.ContractNo != contract.ContractNo)
        {
            if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo))
                return ApiResult<int>.Failure([$"Contract with number '{dto.ContractNo}' already exists."]);

            contract.ContractNo = dto.ContractNo;
        }

        if (dto.ClientName is not null) contract.ClientName = dto.ClientName;
        if (dto.ProductType is not null) contract.ProductType = dto.ProductType;
        if (dto.Quantity.HasValue) contract.Quantity = dto.Quantity.Value;
        if (dto.Unit is not null) contract.Unit = dto.Unit;
        if (dto.StartDate.HasValue) contract.StartDate = dto.StartDate.Value;
        if (dto.EndDate.HasValue) contract.EndDate = dto.EndDate.Value;
        if (dto.DepartmentId.HasValue) contract.DepartmentId = dto.DepartmentId.Value;
        if (dto.Priority.HasValue) contract.Priority = dto.Priority.Value;
        if (dto.ContractParty is not null) contract.ContractParty = dto.ContractParty;
        if (dto.Notes is not null) contract.Notes = dto.Notes;

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
            .Include(cu => cu.User).ThenInclude(u => u.Role)
            .AsNoTracking()
            .Select(cu => new ContractUserDto
            {
                UserId   = cu.UserId,
                FullName = $"{cu.User.FirstName} {cu.User.LastName}",
                RoleName = cu.User.Role != null ? cu.User.Role.Name : null,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractUserDto>>.Success(users);
    }

    public async Task<ApiResult<int>> AssignUsersAsync(Guid contractId, List<Guid> userIds)
    {
        var exists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!exists)
            return ApiResult<int>.Failure([$"Contract '{contractId}' not found."], 404);

        var existing = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .Select(cu => cu.UserId)
            .ToListAsync();

        var toAdd = userIds.Distinct().Except(existing).ToList();

        if (toAdd.Count > 0)
        {
            _context.ContractUsers.AddRange(toAdd.Select(uid => new ContractUser
            {
                ContractId = contractId,
                UserId     = uid,
            }));
            await _context.SaveChangesAsync();
        }

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

    private static ContractResponseDto MapToResponse(Contract contract) => new()
    {
        Id = contract.Id,
        ContractNo = contract.ContractNo,
        ClientName = contract.ClientName,
        ProductType = contract.ProductType,
        Quantity = contract.Quantity,
        Unit = contract.Unit,
        StartDate = contract.StartDate,
        EndDate = contract.EndDate,
        DepartmentId = contract.DepartmentId,
        DepartmentName = contract.Department?.Name,
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
                UserId   = cu.UserId,
                FullName = $"{cu.User!.FirstName} {cu.User.LastName}",
                RoleName = cu.User.Role?.Name,
            }).ToList(),
    };
}
