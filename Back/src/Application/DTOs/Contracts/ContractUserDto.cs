namespace Application.DTOs.Contracts;

public class ContractUserDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? RoleName { get; set; }
}
