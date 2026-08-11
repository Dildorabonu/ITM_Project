using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class MeterReadingConfiguration : IEntityTypeConfiguration<MeterReading>
{
    public void Configure(EntityTypeBuilder<MeterReading> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.DeviceName).HasMaxLength(200).IsRequired();

        // Qurilma bo'yicha oxirgi o'lchovlarni tez olish uchun
        builder.HasIndex(x => new { x.DeviceName, x.CreatedAt });

        // Faqat vaqt bo'yicha oyna so'rovlari uchun (joriy soat, rollup bo'laklari).
        // Kompozit indeks CreatedAt bo'yicha range-seek bera olmaydi — birinchi
        // ustun DeviceName bo'lgani uchun.
        builder.HasIndex(x => x.CreatedAt);
    }
}
