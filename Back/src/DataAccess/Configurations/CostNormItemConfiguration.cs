using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class CostNormItemConfiguration : IEntityTypeConfiguration<CostNormItem>
{
    public void Configure(EntityTypeBuilder<CostNormItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.HasOne(i => i.CostNorm)
            .WithMany(c => c.Items)
            .HasForeignKey(i => i.CostNormId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
