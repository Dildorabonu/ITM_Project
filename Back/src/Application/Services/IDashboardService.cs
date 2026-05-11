using Application.DTOs;
using Application.DTOs.Dashboard;

namespace Application.Services;

public interface IDashboardService
{
    Task<ApiResult<DashboardSummaryDto>> GetSummaryAsync();
}
