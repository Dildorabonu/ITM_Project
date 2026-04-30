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

        builder.HasIndex(p => p.ContractId);
    }
}
