using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class TechProcessMaterialConfiguration : IEntityTypeConfiguration<TechProcessMaterial>
{
    public void Configure(EntityTypeBuilder<TechProcessMaterial> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.RequiredQty).HasColumnType("decimal(18,4)");
        builder.Property(m => m.AvailableQty).HasColumnType("decimal(18,4)");

        builder.HasOne(m => m.TechProcess)
            .WithMany(t => t.Materials)
            .HasForeignKey(m => m.TechProcessId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Material)
            .WithMany(mat => mat.TechProcessMaterials)
            .HasForeignKey(m => m.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
