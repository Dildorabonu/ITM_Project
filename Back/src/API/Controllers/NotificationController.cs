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
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _service.GetByUserAsync(userId.Value));
    }

    // Qo'ng'iroq belgisi uchun — hisob va bir nechta oxirgi sarlavha, to'liq ro'yxat emas.
    [HttpGet("unread")]
    public async Task<IActionResult> GetUnread()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _service.GetUnreadAsync(userId.Value));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.MarkAsReadAsync(id, userId.Value);
        if (!result.Succeeded) return StatusCode(result.StatusCode, result);
        return NoContent();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        await _service.MarkAllAsReadAsync(userId.Value);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.DeleteOwnAsync(id, userId.Value);
        if (!result.Succeeded) return StatusCode(result.StatusCode, result);
        return NoContent();
    }
}
