using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractProductUserConfiguration : IEntityTypeConfiguration<ContractProductUser>
{
    public void Configure(EntityTypeBuilder<ContractProductUser> builder)
    {
        builder.HasKey(x => new { x.ContractProductId, x.UserId, x.Role });

        builder.HasOne(x => x.Product)
            .WithMany(p => p.ProductUsers)
            .HasForeignKey(x => x.ContractProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.User)
            .WithMany(u => u.ContractProductUsers)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
