namespace Application.DTOs.Permissions;

public class PermissionModuleResponseDto
{
    public string Module { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public string ModuleIcon { get; set; } = string.Empty;
    public List<PermissionResponseDto> Actions { get; set; } = [];
}
