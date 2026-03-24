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
        Status = contract.Status,
        Notes = contract.Notes,
        CreatedBy = contract.CreatedBy,
        CreatedByFullName = contract.Creator is not null
            ? $"{contract.Creator.FirstName} {contract.Creator.LastName}"
            : null,
        CreatedAt = contract.CreatedAt
    };
}
