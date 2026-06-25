using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractProductStageConfiguration : IEntityTypeConfiguration<ContractProductStage>
{
    public void Configure(EntityTypeBuilder<ContractProductStage> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.ContractProduct)
            .WithMany(p => p.Stages)
            .HasForeignKey(s => s.ContractProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each stage type appears at most once per product (toggle, not multiplicity).
        builder.HasIndex(s => new { s.ContractProductId, s.StageType }).IsUnique();
    }
}
