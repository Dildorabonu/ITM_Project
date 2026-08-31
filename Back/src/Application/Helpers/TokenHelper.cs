using Application.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Application.Helpers;

public static class TokenHelper
{
    public static (string Token, DateTime ExpiresAt) GenerateToken(
        Guid userId, string username, string role, JwtOptions jwtOptions,
        string firstName = "", string lastName = "",
        IEnumerable<string>? permissions = null,
        Guid? departmentId = null,
        Guid? sessionId = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role),
            new(ClaimTypes.GivenName, firstName),
            new(ClaimTypes.Surname, lastName)
        };

        if (departmentId.HasValue)
            claims.Add(new Claim("dept", departmentId.Value.ToString()));

        // Standart "sid" emas — uni JwtSecurityTokenHandler uzun URI'ga o'girib yuboradi.
        if (sessionId.HasValue)
            claims.Add(new Claim("sess", sessionId.Value.ToString()));

        if (permissions is not null)
        {
            foreach (var perm in permissions)
                claims.Add(new Claim("perm", perm));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(jwtOptions.TokenExpirationMinutes);

        var token = new JwtSecurityToken(
            issuer: jwtOptions.Issuer,
            audience: jwtOptions.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    // Refresh tokenlar autentifikatsiya sirlari — Guid emas, kriptografik jihatdan
    // xavfsiz tasodifiy 256-bit qiymat ishlatamiz. Hex kodlash cookie/URL uchun xavfsiz
    // (faqat 0-9a-f), va to'qnashuv ehtimoli amalda nolga teng.
    public static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes);
    }
}
