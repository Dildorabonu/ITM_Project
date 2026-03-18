using Core.Enums;

namespace Core.Entities;

public class Permission
{
    public Guid Id { get; set; }
    public PermissionModule Module { get; set; }
    public PermissionAction Action { get; set; }

    public string Key => $"{Module}.{Action}";

    // Navigation properties
    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
