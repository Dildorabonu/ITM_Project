using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class ContractDepartmentConfiguration : IEntityTypeConfiguration<ContractDepartment>
{
    public void Configure(EntityTypeBuilder<ContractDepartment> builder)
    {
        builder.HasKey(cd => new { cd.ContractId, cd.DepartmentId });

        builder.HasOne(cd => cd.Contract)
            .WithMany(c => c.ContractDepartments)
            .HasForeignKey(cd => cd.ContractId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cd => cd.Department)
            .WithMany(d => d.ContractDepartments)
            .HasForeignKey(cd => cd.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
