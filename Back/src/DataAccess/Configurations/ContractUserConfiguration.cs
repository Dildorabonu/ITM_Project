using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractUserConfiguration : IEntityTypeConfiguration<ContractUser>
{
    public void Configure(EntityTypeBuilder<ContractUser> builder)
    {
        builder.HasKey(cu => new { cu.ContractId, cu.UserId });

        builder.HasOne(cu => cu.Contract)
            .WithMany(c => c.ContractUsers)
            .HasForeignKey(cu => cu.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cu => cu.User)
            .WithMany(u => u.ContractUsers)
            .HasForeignKey(cu => cu.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
