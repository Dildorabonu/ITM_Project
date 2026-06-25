using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class WorkflowTemplateStageConfiguration : IEntityTypeConfiguration<WorkflowTemplateStage>
{
    public void Configure(EntityTypeBuilder<WorkflowTemplateStage> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.WorkflowTemplate)
            .WithMany(t => t.Stages)
            .HasForeignKey(s => s.WorkflowTemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        // Each stage type appears at most once per template.
        builder.HasIndex(s => new { s.WorkflowTemplateId, s.StageType }).IsUnique();
    }
}
