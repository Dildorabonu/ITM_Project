using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class RequisitionItemConfiguration : IEntityTypeConfiguration<RequisitionItem>
{
    public void Configure(EntityTypeBuilder<RequisitionItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Quantity).HasPrecision(18, 4);
        builder.Property(i => i.Notes).HasMaxLength(500);

        builder.HasOne(i => i.Requisition)
            .WithMany(r => r.Items)
            .HasForeignKey(i => i.RequisitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Material)
            .WithMany()
            .HasForeignKey(i => i.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
