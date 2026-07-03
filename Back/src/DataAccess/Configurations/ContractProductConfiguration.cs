using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractProductConfiguration : IEntityTypeConfiguration<ContractProduct>
{
    public void Configure(EntityTypeBuilder<ContractProduct> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.ProductType).HasMaxLength(255).IsRequired();
        builder.Property(p => p.Unit).HasMaxLength(64).IsRequired();

        builder.HasOne(p => p.Contract)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        // Katalogga bog'lanish ixtiyoriy. Katalog mahsuloti o'chirilsa shartnoma qatori
        // qolaveradi (ProductType nomi saqlangan) — shuning uchun SetNull.
        builder.HasOne(p => p.ProductCatalog)
            .WithMany(pc => pc.ContractProducts)
            .HasForeignKey(p => p.ProductCatalogId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(p => p.ContractId);
        builder.HasIndex(p => p.ProductCatalogId);
    }
}
