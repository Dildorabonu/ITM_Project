using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractProductDepartmentConfiguration : IEntityTypeConfiguration<ContractProductDepartment>
{
    public void Configure(EntityTypeBuilder<ContractProductDepartment> builder)
    {
        builder.HasKey(x => new { x.ContractProductId, x.DepartmentId });

        builder.HasOne(x => x.Product)
            .WithMany(p => p.ProductDepartments)
            .HasForeignKey(x => x.ContractProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Department)
            .WithMany(d => d.ContractProductDepartments)
            .HasForeignKey(x => x.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
