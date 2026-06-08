using System.Text;
using Application.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Application.Tests.Helpers;

public class TrustedOriginValidatorTests
{
    [Theory]
    [InlineData("http://localhost:3000")]
    [InlineData("https://localhost")]
    [InlineData("http://127.0.0.1:5223")]
    [InlineData("http://10.0.0.5:3000")]
    [InlineData("http://172.16.4.9")]
    [InlineData("http://172.31.255.255")]
    [InlineData("http://192.168.1.50:3000")]
    [InlineData("http://[::1]")]
    public void IsTrustedLanOrigin_AllowsLocalhostAndPrivateIps(string origin)
    {
        TrustedOriginValidator.IsTrustedLanOrigin(origin).Should().BeTrue();
    }

    [Theory]
    // Hujumchi nazoratidagi domenlar — eski StartsWith mantig'ini chetlab o'tardi
    [InlineData("http://10.attacker.com")]
    [InlineData("http://192.168.evil.com")]
    [InlineData("http://172.example.com")]
    [InlineData("https://evil.com")]
    // Xususiy bo'lmagan IP lar
    [InlineData("http://8.8.8.8")]
    [InlineData("http://172.15.0.1")]   // 172.16-31 dan tashqari
    [InlineData("http://172.32.0.1")]
    [InlineData("http://11.0.0.1")]     // 10/8 dan tashqari
    [InlineData("ftp://10.0.0.1")]      // noto'g'ri sxema
    [InlineData("")]
    [InlineData(null)]
    public void IsTrustedLanOrigin_RejectsUntrustedOrigins(string? origin)
    {
        TrustedOriginValidator.IsTrustedLanOrigin(origin).Should().BeFalse();
    }
}

public class TokenHelperTests
{
    [Fact]
    public void GenerateRefreshToken_Produces256BitHexToken()
    {
        var token = TokenHelper.GenerateRefreshToken();

        token.Should().HaveLength(64, "32 bayt = 64 hex belgisi");
        token.Should().MatchRegex("^[0-9A-F]+$");
    }

    [Fact]
    public void GenerateRefreshToken_IsUniqueAcrossManyCalls()
    {
        var tokens = Enumerable.Range(0, 10_000)
            .Select(_ => TokenHelper.GenerateRefreshToken())
            .ToHashSet();

        tokens.Should().HaveCount(10_000, "kriptografik tokenlar takrorlanmasligi kerak");
    }
}

public class FileValidatorTests
{
    private static IFormFile MakeFile(string fileName, byte[] content)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/octet-stream",
        };
    }

    private static byte[] ValidWebp()
    {
        // RIFF....WEBP + biroz to'ldiruvchi
        var bytes = new byte[20];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(bytes, 0);
        bytes[4] = 0x0C; // hajm (ahamiyatsiz)
        Encoding.ASCII.GetBytes("WEBP").CopyTo(bytes, 8);
        return bytes;
    }

    [Fact]
    public void TryValidate_ValidWebp_Passes()
    {
        var ok = FileValidator.TryValidate(MakeFile("img.webp", ValidWebp()), out var error);
        ok.Should().BeTrue();
        error.Should().BeNull();
    }

    [Fact]
    public void TryValidate_RiffButNotWebp_IsRejected()
    {
        // RIFF konteyner, lekin WEBP emas (masalan WAV/AVI) — eski mantiq buni
        // noto'g'ri qabul qilardi.
        var bytes = new byte[20];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(bytes, 0);
        Encoding.ASCII.GetBytes("AVI ").CopyTo(bytes, 8);

        var ok = FileValidator.TryValidate(MakeFile("img.webp", bytes), out var error);
        ok.Should().BeFalse();
        error.Should().Contain("magic bytes");
    }

    [Fact]
    public void TryValidate_TooShortWebp_IsRejected()
    {
        var ok = FileValidator.TryValidate(MakeFile("img.webp", Encoding.ASCII.GetBytes("RIFF")), out _);
        ok.Should().BeFalse();
    }

    [Fact]
    public void TryValidate_ValidPng_Passes()
    {
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00 };
        FileValidator.TryValidate(MakeFile("a.png", png), out _).Should().BeTrue();
    }

    [Fact]
    public void TryValidate_SpoofedContentType_IsRejected()
    {
        // .png deb nomlangan, lekin tarkibi PNG emas
        var ok = FileValidator.TryValidate(MakeFile("a.png", Encoding.ASCII.GetBytes("NOT-A-PNG-AT-ALL")), out var error);
        ok.Should().BeFalse();
        error.Should().Contain("magic bytes");
    }

    [Fact]
    public void TryValidate_DisallowedExtension_IsRejected()
    {
        var ok = FileValidator.TryValidate(MakeFile("evil.exe", new byte[] { 0x4D, 0x5A }), out var error);
        ok.Should().BeFalse();
        error.Should().Contain("ruxsat etilmagan");
    }
}
