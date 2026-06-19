using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductUnitToNameUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_Name_DepartmentId",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Name_DepartmentId_Unit",
                table: "Products",
                columns: new[] { "Name", "DepartmentId", "Unit" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_Name_DepartmentId_Unit",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Name_DepartmentId",
                table: "Products",
                columns: new[] { "Name", "DepartmentId" },
                unique: true);
        }
    }
}
