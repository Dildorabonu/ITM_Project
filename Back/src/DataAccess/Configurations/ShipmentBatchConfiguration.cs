using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ShipmentBatchConfiguration : IEntityTypeConfiguration<ShipmentBatch>
{
    public void Configure(EntityTypeBuilder<ShipmentBatch> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Amount).HasPrecision(18, 2);
        builder.Property(s => s.Notes).HasMaxLength(500);

        builder.HasOne(s => s.Contract)
            .WithMany()
            .HasForeignKey(s => s.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.ContractProduct)
            .WithMany()
            .HasForeignKey(s => s.ContractProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Department)
            .WithMany()
            .HasForeignKey(s => s.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Creator)
            .WithMany()
            .HasForeignKey(s => s.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => new { s.ContractId, s.ContractProductId, s.BatchNo })
            .IsUnique();
    }
}
