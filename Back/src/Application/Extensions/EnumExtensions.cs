using System.ComponentModel.DataAnnotations;
using System.Reflection;

namespace Application.Extensions;

public static class EnumExtensions
{
    public static string GetDisplayName(this Enum value)
    {
        var attr = value.GetType()
            .GetField(value.ToString())
            ?.GetCustomAttribute<DisplayAttribute>();
        return attr?.Name ?? value.ToString();
    }

    public static string GetDisplayIcon(this Enum value)
    {
        var attr = value.GetType()
            .GetField(value.ToString())
            ?.GetCustomAttribute<DisplayAttribute>();
        return attr?.Description ?? string.Empty;
    }
}
