using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Quantity).HasPrecision(18, 4);
        builder.Property(p => p.ReservedQuantity).HasPrecision(18, 4).HasDefaultValue(0m);

        builder.Property(p => p.InvoiceNumber)
            .IsRequired();

        builder.HasIndex(p => p.InvoiceNumber)
            .IsUnique();

        builder.HasIndex(p => new { p.Name, p.DepartmentId })
            .IsUnique();

        builder.HasOne(p => p.Department)
            .WithMany(d => d.Products)
            .HasForeignKey(p => p.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
