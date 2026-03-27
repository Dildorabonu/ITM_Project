using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class TechnicalDrawingConfiguration : IEntityTypeConfiguration<TechnicalDrawing>
{
    public void Configure(EntityTypeBuilder<TechnicalDrawing> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Title).IsRequired().HasMaxLength(512);
        builder.Property(d => d.Notes).HasMaxLength(2000);

        builder.HasOne(d => d.Contract)
            .WithMany(c => c.TechnicalDrawings)
            .HasForeignKey(d => d.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(d => d.Creator)
            .WithMany(u => u.CreatedTechnicalDrawings)
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
