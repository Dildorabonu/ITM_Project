using SysTask = System.Threading.Tasks.Task;

namespace Application.Services;

public interface IActivityLogService
{
    SysTask LogAsync(string kind, string title, string? subtitle, Guid? actorId, Guid? refId);
}
