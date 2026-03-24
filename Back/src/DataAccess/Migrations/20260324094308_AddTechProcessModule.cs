using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddTechProcessModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TechProcessMaterials_Materials_MaterialId",
                table: "TechProcessMaterials");

            migrationBuilder.AlterColumn<decimal>(
                name: "RequiredQty",
                table: "TechProcessMaterials",
                type: "numeric(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "AvailableQty",
                table: "TechProcessMaterials",
                type: "numeric(18,4)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddForeignKey(
                name: "FK_TechProcessMaterials_Materials_MaterialId",
                table: "TechProcessMaterials",
                column: "MaterialId",
                principalTable: "Materials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TechProcessMaterials_Materials_MaterialId",
                table: "TechProcessMaterials");

            migrationBuilder.AlterColumn<decimal>(
                name: "RequiredQty",
                table: "TechProcessMaterials",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)");

            migrationBuilder.AlterColumn<decimal>(
                name: "AvailableQty",
                table: "TechProcessMaterials",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)");

            migrationBuilder.AddForeignKey(
                name: "FK_TechProcessMaterials_Materials_MaterialId",
                table: "TechProcessMaterials",
                column: "MaterialId",
                principalTable: "Materials",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
