using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ProductCatalogConfiguration : IEntityTypeConfiguration<ProductCatalog>
{
    public void Configure(EntityTypeBuilder<ProductCatalog> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).HasMaxLength(255).IsRequired();
        builder.Property(p => p.NameNormalized).HasMaxLength(255).IsRequired();
        builder.Property(p => p.Code).HasMaxLength(32).IsRequired();
        builder.Property(p => p.Unit).HasMaxLength(64);

        // Kanonik nom bo'yicha noyoblik — bir xil mahsulot ikki marta kiritilmasligi uchun.
        builder.HasIndex(p => p.NameNormalized).IsUnique();
        builder.HasIndex(p => p.Code).IsUnique();
    }
}
