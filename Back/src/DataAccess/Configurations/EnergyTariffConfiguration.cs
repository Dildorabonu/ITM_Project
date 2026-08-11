using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class EnergyTariffConfiguration : IEntityTypeConfiguration<EnergyTariff>
{
    public void Configure(EntityTypeBuilder<EnergyTariff> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.PricePerKwh).HasPrecision(18, 2);
        builder.Property(x => x.Currency).HasMaxLength(16).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(512);

        // Bitta sanada bitta tarif — takrorlanish tarifni noaniq qiladi.
        builder.HasIndex(x => x.EffectiveFrom).IsUnique();
    }
}
