using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ManufacturedProductConfiguration : IEntityTypeConfiguration<ManufacturedProduct>
{
    public void Configure(EntityTypeBuilder<ManufacturedProduct> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(256);
        builder.Property(p => p.Code).HasMaxLength(64);
        builder.Property(p => p.Quantity).HasPrecision(18, 4);
        builder.Property(p => p.ProducedQuantity).HasPrecision(18, 4);

        builder.HasIndex(p => p.Status);
        builder.HasIndex(p => p.DepartmentId);

        builder.HasOne(p => p.Department)
            .WithMany()
            .HasForeignKey(p => p.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Contract)
            .WithMany()
            .HasForeignKey(p => p.ContractId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(p => p.Creator)
            .WithMany()
            .HasForeignKey(p => p.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
