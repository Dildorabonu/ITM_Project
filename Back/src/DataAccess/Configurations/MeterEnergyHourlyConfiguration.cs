using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class MeterEnergyHourlyConfiguration : IEntityTypeConfiguration<MeterEnergyHourly>
{
    public void Configure(EntityTypeBuilder<MeterEnergyHourly> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DeviceName).HasMaxLength(200).IsRequired();

        // Rollup upsert va davr bo'yicha o'qish — ikkalasi ham shu kalit ustidan.
        builder.HasIndex(x => new { x.DeviceName, x.HourUtc }).IsUnique();

        // Umumiy (barcha qurilma) davr so'rovi uchun.
        builder.HasIndex(x => x.HourUtc);
    }
}
