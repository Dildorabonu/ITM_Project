using Microsoft.Extensions.Options;

namespace Application.Tests.Infrastructure;

/// <summary>
/// <c>IOptions&lt;T&gt;</c> ni tez yasash uchun yordamchi.
/// Servislarda <c>IOptions&lt;JwtOptions&gt;</c> kabi parametrlarni mock o'rniga bevosita
/// <see cref="Options.Create{T}"/> bilan ishlatib bo'ladi — bu shunchaki uni bir joyga to'playdi.
/// </summary>
public static class OptionsHelper
{
    public static IOptions<T> Wrap<T>(T value) where T : class, new() =>
        Microsoft.Extensions.Options.Options.Create(value);
}
