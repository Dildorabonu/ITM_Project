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

        builder.Property(p => p.NameNormalized)
            .IsRequired()
            .HasDefaultValue("");

        builder.HasIndex(p => p.InvoiceNumber)
            .IsUnique();

        // Bir bo'limda bir xil nomli mahsulot turli birlikda alohida saqlanadi
        // (masalan "olma — kg" va "olma — dona"). Shu sabab Unit ham kalitга kiradi.
        builder.HasIndex(p => new { p.Name, p.DepartmentId, p.Unit })
            .IsUnique();

        builder.HasOne(p => p.Department)
            .WithMany(d => d.Products)
            .HasForeignKey(p => p.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Material o'chsa inventar o'chmaydi — faqat bog'lanish uziladi (unlinked).
        builder.HasOne(p => p.Material)
            .WithMany()
            .HasForeignKey(p => p.MaterialId)
            .OnDelete(DeleteBehavior.SetNull);

        // Unique EMAS — mavjud dublikatlarda migration sinmasligi uchun.
        builder.HasIndex(p => new { p.DepartmentId, p.MaterialId });
    }
}
