using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace Application.Extensions;

public static class EnumExtensions
{
    // Reflection natijasi o'zgarmaydi — enum qiymati bo'yicha bir marta hisoblanib keshlanadi.
    private static readonly ConcurrentDictionary<Enum, string> DisplayNames = new();

    public static string GetDisplayName(this Enum value) =>
        DisplayNames.GetOrAdd(value, static v =>
            v.GetType()
             .GetField(v.ToString())
             ?.GetCustomAttribute<DisplayAttribute>()?.Name
            ?? v.ToString());
}
