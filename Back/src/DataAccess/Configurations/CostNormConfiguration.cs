using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class CostNormConfiguration : IEntityTypeConfiguration<CostNorm>
{
    public void Configure(EntityTypeBuilder<CostNorm> builder)
    {
        builder.HasKey(c => c.Id);

        builder.HasOne(c => c.Contract)
            .WithMany(ct => ct.CostNorms)
            .HasForeignKey(c => c.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Creator)
            .WithMany()
            .HasForeignKey(c => c.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
