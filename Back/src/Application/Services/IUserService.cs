using Application.DTOs;
using Application.DTOs.Users;
using Application.Helpers;

namespace Application.Services;

public interface IUserService
{
    Task<ApiResult<PagedResult<UserResponseDto>>> GetAllAsync(PaginationParams pagination);
    Task<ApiResult<IEnumerable<UserLookupDto>>> GetLookupAsync();
    Task<ApiResult<PagedResult<EmployeeResponseDto>>> GetEmployeesAsync(PaginationParams pagination);
    Task<ApiResult<IEnumerable<UserContractDto>>> GetContractsAsync(Guid id);
    Task<ApiResult<int>> CreateAsync(UserCreateDto dto);
    Task<ApiResult<int>> UpdateAsync(Guid id, UserUpdateDto dto);
    Task<ApiResult<int>> SetActiveAsync(Guid id, bool isActive);
}
