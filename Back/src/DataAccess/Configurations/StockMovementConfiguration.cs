using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Quantity).HasPrecision(18, 4);
        builder.Property(s => s.QuantityAfter).HasPrecision(18, 4);

        // Navlar parametrsiz WithMany() bilan — Product/User/Department/Requisition/Contract
        // entity'lariga back-collection qo'shilmaydi (blast radius minimal).
        builder.HasOne(s => s.Product)
            .WithMany()
            .HasForeignKey(s => s.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Material)
            .WithMany()
            .HasForeignKey(s => s.MaterialId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.SourceDepartment)
            .WithMany()
            .HasForeignKey(s => s.SourceDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.TargetDepartment)
            .WithMany()
            .HasForeignKey(s => s.TargetDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Requisition)
            .WithMany()
            .HasForeignKey(s => s.RequisitionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Contract)
            .WithMany()
            .HasForeignKey(s => s.ContractId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => new { s.ProductId, s.CreatedAt });
        builder.HasIndex(s => s.RequisitionId);
        builder.HasIndex(s => s.MaterialId);
        builder.HasIndex(s => s.CreatedAt);
    }
}
