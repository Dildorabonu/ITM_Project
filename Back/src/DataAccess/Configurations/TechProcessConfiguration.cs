using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class TechProcessConfiguration : IEntityTypeConfiguration<TechProcess>
{
    public void Configure(EntityTypeBuilder<TechProcess> builder)
    {
        builder.HasKey(t => t.Id);

        builder.HasOne(t => t.Approver)
            .WithMany(u => u.ApprovedProcesses)
            .HasForeignKey(t => t.ApprovedBy)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Contract)
            .WithMany(c => c.TechProcesses)
            .HasForeignKey(t => t.ContractId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
