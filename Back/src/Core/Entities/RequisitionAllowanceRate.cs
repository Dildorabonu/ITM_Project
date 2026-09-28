namespace Core.Entities;

// Tarix o'zgarmas: yozuvlar faqat qo'shiladi, amaldagi foiz — eng oxirgi yozuv.
public class RequisitionAllowanceRate
{
    public Guid Id { get; set; }
    public decimal Percent { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
}
