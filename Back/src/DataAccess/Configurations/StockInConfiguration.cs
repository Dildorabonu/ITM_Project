using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class StockInConfiguration : IEntityTypeConfiguration<StockIn>
{
    public void Configure(EntityTypeBuilder<StockIn> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.Receiver)
            .WithMany(u => u.ReceivedStockIns)
            .HasForeignKey(s => s.ReceivedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Material)
            .WithMany(m => m.StockIns)
            .HasForeignKey(s => s.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Contract)
            .WithMany(c => c.StockIns)
            .HasForeignKey(s => s.ContractId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
