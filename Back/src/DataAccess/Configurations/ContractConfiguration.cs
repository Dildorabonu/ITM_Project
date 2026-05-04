using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> builder)
    {
        builder.HasKey(c => c.Id);

        builder.HasIndex(c => c.ContractNo)
            .IsUnique()
            .HasFilter("\"IsActive\" = TRUE");

        builder.HasOne(c => c.Creator)
            .WithMany(u => u.CreatedContracts)
            .HasForeignKey(c => c.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
