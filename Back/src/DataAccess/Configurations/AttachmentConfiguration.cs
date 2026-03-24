using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.EntityType).IsRequired().HasMaxLength(64);
        builder.Property(a => a.FileName).IsRequired().HasMaxLength(256);
        builder.Property(a => a.StoredName).IsRequired().HasMaxLength(256);
        builder.Property(a => a.ContentType).IsRequired().HasMaxLength(128);

        builder.HasIndex(a => new { a.EntityType, a.EntityId });

        builder.HasOne(a => a.Uploader)
            .WithMany()
            .HasForeignKey(a => a.UploadedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
