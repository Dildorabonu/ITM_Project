using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class ConvertProductUnitToEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Products"" ALTER COLUMN ""Unit"" DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""Products"" ALTER COLUMN ""Unit"" TYPE integer USING 0;");
            migrationBuilder.Sql(@"ALTER TABLE ""Products"" ALTER COLUMN ""Unit"" SET DEFAULT 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Unit",
                table: "Products",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
