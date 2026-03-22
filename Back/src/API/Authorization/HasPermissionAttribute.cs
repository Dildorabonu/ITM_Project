using Microsoft.AspNetCore.Authorization;

namespace API.Authorization;

public class HasPermissionAttribute(string permission) : AuthorizeAttribute(permission)
{
}
