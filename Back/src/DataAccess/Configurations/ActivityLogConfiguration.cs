using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Kind).HasMaxLength(32).IsRequired();
        builder.Property(a => a.Title).HasMaxLength(512).IsRequired();
        builder.Property(a => a.Subtitle).HasMaxLength(512);
        builder.Property(a => a.ActorName).HasMaxLength(256);

        builder.HasOne(a => a.Actor)
            .WithMany()
            .HasForeignKey(a => a.ActorId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(a => a.CreatedAt).IsDescending();
        builder.HasIndex(a => new { a.Kind, a.CreatedAt });
    }
}
