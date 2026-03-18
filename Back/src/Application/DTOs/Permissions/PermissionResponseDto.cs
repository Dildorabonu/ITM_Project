namespace Application.DTOs.Permissions;

public class PermissionResponseDto
{
    public Guid Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string ActionName { get; set; } = string.Empty;
    public string ActionIcon { get; set; } = string.Empty;
}
