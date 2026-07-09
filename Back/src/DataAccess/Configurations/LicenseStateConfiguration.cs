using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class LicenseStateConfiguration : IEntityTypeConfiguration<LicenseState>
{
    public void Configure(EntityTypeBuilder<LicenseState> builder)
    {
        builder.ToTable("LicenseState");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TamperReason).HasMaxLength(500);
    }
}
