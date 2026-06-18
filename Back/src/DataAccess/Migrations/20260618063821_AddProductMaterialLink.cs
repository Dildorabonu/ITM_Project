using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductMaterialLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_DepartmentId",
                table: "Products");

            migrationBuilder.AddColumn<Guid>(
                name: "MaterialId",
                table: "Products",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_DepartmentId_MaterialId",
                table: "Products",
                columns: new[] { "DepartmentId", "MaterialId" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_MaterialId",
                table: "Products",
                column: "MaterialId");

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Materials_MaterialId",
                table: "Products",
                column: "MaterialId",
                principalTable: "Materials",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Backfill: mavjud Productlarni nom bo'yicha Material'ga bog'lash.
            // Faqat bir xil nomli Material YAGONA bo'lsa bog'lanadi — ambiguity NULL qoladi
            // (xavfsiz default: bog'lanmagan = FreeText kabi ishlanadi).
            migrationBuilder.Sql(@"
                UPDATE ""Products"" p
                SET ""MaterialId"" = m.""Id""
                FROM ""Materials"" m
                WHERE p.""MaterialId"" IS NULL
                  AND lower(trim(p.""Name"")) = lower(trim(m.""Name""))
                  AND (SELECT count(*) FROM ""Materials"" m2
                       WHERE lower(trim(m2.""Name"")) = lower(trim(m.""Name""))) = 1;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Products_Materials_MaterialId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_DepartmentId_MaterialId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_MaterialId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MaterialId",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Products_DepartmentId",
                table: "Products",
                column: "DepartmentId");
        }
    }
}
