using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class StockOutConfiguration : IEntityTypeConfiguration<StockOut>
{
    public void Configure(EntityTypeBuilder<StockOut> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne(s => s.Issuer)
            .WithMany(u => u.IssuedStockOuts)
            .HasForeignKey(s => s.IssuedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Material)
            .WithMany(m => m.StockOuts)
            .HasForeignKey(s => s.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Department)
            .WithMany(d => d.StockOuts)
            .HasForeignKey(s => s.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Contract)
            .WithMany(c => c.StockOuts)
            .HasForeignKey(s => s.ContractId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
