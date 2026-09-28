using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DataAccess.Configurations;

public class RequisitionAllowanceRateConfiguration : IEntityTypeConfiguration<RequisitionAllowanceRate>
{
    public void Configure(EntityTypeBuilder<RequisitionAllowanceRate> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Percent).HasPrecision(5, 2);
        builder.Property(x => x.Note).HasMaxLength(500);

        builder.HasIndex(x => x.CreatedAt);
    }
}
