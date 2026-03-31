using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractTaskDailyLogConfiguration : IEntityTypeConfiguration<ContractTaskDailyLog>
{
    public void Configure(EntityTypeBuilder<ContractTaskDailyLog> builder)
    {
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Amount).HasPrecision(18, 2);
        builder.Property(l => l.Note).HasMaxLength(500);

        builder.HasOne(l => l.Task)
            .WithMany(t => t.DailyLogs)
            .HasForeignKey(l => l.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Creator)
            .WithMany()
            .HasForeignKey(l => l.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
