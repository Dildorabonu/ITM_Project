using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _service;

    public NotificationController(INotificationService service)
    {
        _service = service;
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var canView    = User.HasClaim("perm", "Notifications.View");
        var canViewAll = User.HasClaim("perm", "Notifications.ViewAll");

        if (!canView && !canViewAll)
            return Forbid();

        if (canViewAll)
        {
            var all = await _service.GetAllNotificationsAsync();
            return Ok(all);
        }

        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetByUserAsync(userId.Value);
        return Ok(result);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetUnreadCountAsync(userId.Value);
        return Ok(result);
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.MarkAsReadAsync(id, userId.Value);
        if (!result.Succeeded) return NotFound(result);
        return Ok(result);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.MarkAllAsReadAsync(userId.Value);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.DeleteAsync(id, userId.Value);
        if (!result.Succeeded) return NotFound(result);
        return Ok(result);
    }
}
