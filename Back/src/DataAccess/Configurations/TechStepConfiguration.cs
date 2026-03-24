using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class TechStepConfiguration : IEntityTypeConfiguration<TechStep>
{
    public void Configure(EntityTypeBuilder<TechStep> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.TechProcess)
            .WithMany(t => t.Steps)
            .HasForeignKey(s => s.TechProcessId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
