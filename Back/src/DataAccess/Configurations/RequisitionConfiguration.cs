using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class RequisitionConfiguration : IEntityTypeConfiguration<Requisition>
{
    public void Configure(EntityTypeBuilder<Requisition> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.RequisitionNo).IsRequired().HasMaxLength(50);
        builder.Property(r => r.Purpose).IsRequired().HasMaxLength(500);
        builder.Property(r => r.Notes).HasMaxLength(1000);
        builder.Property(r => r.RejectionReason).HasMaxLength(500);
        builder.Property(r => r.QrCodeData).HasColumnType("text");

        builder.HasOne(r => r.Creator)
            .WithMany(u => u.CreatedRequisitions)
            .HasForeignKey(r => r.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Approver)
            .WithMany(u => u.ApprovedRequisitions)
            .HasForeignKey(r => r.ApprovedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Contract)
            .WithMany()
            .HasForeignKey(r => r.ContractId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.Department)
            .WithMany()
            .HasForeignKey(r => r.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
