using System.Security.Claims;
using API.Authentication;
using Application.DTOs;
using Application.DTOs.Auth;
using Application.Options;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IAuthCookieWriter _cookieWriter;
    private readonly AuthCookieOptions _cookieOptions;

    public AuthController(
        IAuthService authService,
        IAuthCookieWriter cookieWriter,
        IOptions<AuthCookieOptions> cookieOptions)
    {
        _authService = authService;
        _cookieWriter = cookieWriter;
        _cookieOptions = cookieOptions.Value;
    }

    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto);

        // Lockout (423) va boshqa maxsus statuslar frontendga aynan yetib borishi kerak —
        // hammasini 401 ga yig'ib yuborsak, klient blok xabarini ko'rsata olmaydi.
        if (!result.Succeeded || result.Result is null)
            return StatusCode(result.StatusCode > 0 ? result.StatusCode : 401, result);

        WriteAuthCookies(result.Result);

        return Ok(ApiResult<AuthUserDto>.Success(result.Result.User));
    }

    [EnableRateLimiting("refresh")]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = Request.Cookies[_cookieOptions.RefreshTokenName];
        if (string.IsNullOrEmpty(refreshToken))
        {
            _cookieWriter.ClearAuthCookies(Response);
            return Unauthorized(ApiResult<object>.Failure(["Refresh token cookie missing."], 401));
        }

        var result = await _authService.RefreshTokenAsync(refreshToken);

        if (!result.Succeeded || result.Result is null)
        {
            _cookieWriter.ClearAuthCookies(Response);
            return Unauthorized(result);
        }

        WriteAuthCookies(result.Result);

        return Ok(ApiResult<AuthUserDto>.Success(result.Result.User));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies[_cookieOptions.RefreshTokenName];
        if (!string.IsNullOrEmpty(refreshToken))
        {
            // Server-side revoke; ignore failures (token may already be expired/rotated)
            await _authService.RevokeTokenAsync(refreshToken);
        }

        _cookieWriter.ClearAuthCookies(Response);
        return Ok(ApiResult<bool>.Success(true));
    }

    [EnableRateLimiting("login")]
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var result = await _authService.ChangePasswordAsync(userId, dto);

        if (!result.Succeeded || result.Result is null)
            return StatusCode(result.StatusCode > 0 ? result.StatusCode : 400, result);

        WriteAuthCookies(result.Result);

        return Ok(ApiResult<AuthUserDto>.Success(result.Result.User));
    }

    [HttpGet("sessions")]
    [Authorize]
    public async Task<IActionResult> Sessions()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        return Ok(await _authService.GetSessionsAsync(userId, CurrentRefreshToken()));
    }

    [HttpDelete("sessions/{familyId:guid}")]
    [Authorize]
    public async Task<IActionResult> RevokeSession(Guid familyId)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var result = await _authService.RevokeSessionAsync(userId, familyId, CurrentRefreshToken());

        if (!result.Succeeded)
            return StatusCode(result.StatusCode > 0 ? result.StatusCode : 400, result);

        return Ok(result);
    }

    [HttpDelete("sessions")]
    [Authorize]
    public async Task<IActionResult> RevokeOtherSessions()
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        return Ok(await _authService.RevokeOtherSessionsAsync(userId, CurrentRefreshToken()));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var result = await _authService.GetUserAsync(userId);

        if (!result.Succeeded)
            return Unauthorized(result);

        return Ok(result);
    }

    private bool TryGetUserId(out Guid userId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private string? CurrentRefreshToken() => Request.Cookies[_cookieOptions.RefreshTokenName];

    private void WriteAuthCookies(AuthResponseDto dto)
    {
        _cookieWriter.WriteAuthCookies(
            Response,
            dto.AccessToken, dto.AccessTokenExpiresAt,
            dto.RefreshToken, dto.RefreshTokenExpiresAt);
    }
}
