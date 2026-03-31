using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractTaskConfiguration : IEntityTypeConfiguration<ContractTask>
{
    public void Configure(EntityTypeBuilder<ContractTask> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).IsRequired().HasMaxLength(500);
        builder.Property(t => t.CompletedAmount).HasPrecision(18, 2);
        builder.Property(t => t.TotalAmount).HasPrecision(18, 2);
        builder.Property(t => t.Importance).HasPrecision(5, 2);

        builder.HasOne(t => t.Contract)
            .WithMany(c => c.ContractTasks)
            .HasForeignKey(t => t.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Creator)
            .WithMany()
            .HasForeignKey(t => t.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
