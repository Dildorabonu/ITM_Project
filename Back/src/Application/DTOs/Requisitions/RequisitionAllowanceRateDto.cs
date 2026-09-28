namespace Application.DTOs.Requisitions;

public class RequisitionAllowanceRateDto
{
    public Guid Id { get; set; }
    public decimal Percent { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    // Seed yozuvida yoki foydalanuvchi o'chirilgan bo'lsa null.
    public string? CreatedByName { get; set; }
}

public class RequisitionAllowanceSaveDto
{
    public decimal Percent { get; set; }
    public string? Note { get; set; }
}
