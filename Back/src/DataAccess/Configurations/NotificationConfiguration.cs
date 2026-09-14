using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(n => n.Id);

        // Ro'yxat so'rovi: WHERE "UserId" = @p ORDER BY "CreatedAt" DESC LIMIT 100.
        // Bu indeks UserId bo'yicha FK qidiruvini ham qoplaydi.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt }, "IX_Notifications_UserId_CreatedAt")
            .IsDescending(false, true);

        // Qo'ng'iroq belgisi har 30 soniyada o'qilmaganlarni so'raydi; qisman indeks
        // jadval o'sib borgani sari ham kichik qoladi.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt }, "IX_Notifications_UserId_CreatedAt_Unread")
            .IsDescending(false, true)
            .HasFilter("NOT \"IsRead\"");

        builder.HasOne(n => n.User)
            .WithMany(u => u.Notifications)
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(n => n.Contract)
            .WithMany()
            .HasForeignKey(n => n.ContractId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
