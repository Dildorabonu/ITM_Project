using Microsoft.AspNetCore.Authorization;

namespace API.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var hasClaim = context.User.Claims
            .Any(c => c.Type == "perm" && c.Value == requirement.Permission);

        if (hasClaim)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
