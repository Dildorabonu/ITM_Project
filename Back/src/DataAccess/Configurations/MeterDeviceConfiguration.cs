using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class MeterDeviceConfiguration : IEntityTypeConfiguration<MeterDevice>
{
    public void Configure(EntityTypeBuilder<MeterDevice> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Ip).HasMaxLength(64).IsRequired();

        // O'chirilgan qurilma nomi qayta ishlatilishi mumkin — u shu nomdagi
        // eski o'lchovlar tarixiga qaytadan ulanadi.
        builder.HasIndex(x => x.Name)
            .IsUnique()
            .HasFilter("\"DeletedAt\" IS NULL");
    }
}
