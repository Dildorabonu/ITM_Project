using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Application.Tests.Infrastructure;

/// <summary>
/// JWT claim'lar va remote IP bilan to'ldirilgan <see cref="IHttpContextAccessor"/> mock yaratadi.
/// Servislar <c>_httpContextAccessor.HttpContext</c> orqali user identity va IP ni o'qiganda ishlatiladi.
/// </summary>
public static class TestHttpContext
{
    public const string DefaultIp = "127.0.0.1";

    public static Mock<IHttpContextAccessor> CreateAccessor(
        Guid? userId = null,
        string? login = null,
        string? role = null,
        IEnumerable<string>? permissions = null,
        string ip = DefaultIp)
    {
        var claims = new List<Claim>();

        if (userId.HasValue)
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));

        if (!string.IsNullOrWhiteSpace(login))
            claims.Add(new Claim(ClaimTypes.Name, login));

        if (!string.IsNullOrWhiteSpace(role))
            claims.Add(new Claim(ClaimTypes.Role, role));

        if (permissions is not null)
            foreach (var p in permissions)
                claims.Add(new Claim("perm", p));

        var identity = new ClaimsIdentity(claims, authenticationType: "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext
        {
            User = principal,
        };

        if (!string.IsNullOrWhiteSpace(ip) && IPAddress.TryParse(ip, out var address))
            httpContext.Connection.RemoteIpAddress = address;

        var accessor = new Mock<IHttpContextAccessor>();
        accessor.SetupGet(a => a.HttpContext).Returns(httpContext);
        return accessor;
    }
}
