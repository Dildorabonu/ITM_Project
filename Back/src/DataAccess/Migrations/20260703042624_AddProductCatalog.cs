using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductCatalogId",
                table: "ContractProducts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductCatalogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    NameNormalized = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductCatalogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContractProducts_ProductCatalogId",
                table: "ContractProducts",
                column: "ProductCatalogId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductCatalogs_Code",
                table: "ProductCatalogs",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductCatalogs_NameNormalized",
                table: "ProductCatalogs",
                column: "NameNormalized",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ContractProducts_ProductCatalogs_ProductCatalogId",
                table: "ContractProducts",
                column: "ProductCatalogId",
                principalTable: "ProductCatalogs",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContractProducts_ProductCatalogs_ProductCatalogId",
                table: "ContractProducts");

            migrationBuilder.DropTable(
                name: "ProductCatalogs");

            migrationBuilder.DropIndex(
                name: "IX_ContractProducts_ProductCatalogId",
                table: "ContractProducts");

            migrationBuilder.DropColumn(
                name: "ProductCatalogId",
                table: "ContractProducts");
        }
    }
}
