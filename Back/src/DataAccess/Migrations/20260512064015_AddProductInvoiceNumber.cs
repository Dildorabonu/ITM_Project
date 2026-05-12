using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductInvoiceNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "");

            // Backfill existing rows with unique placeholders derived from their Id,
            // so the unique index can be created without conflicts.
            migrationBuilder.Sql(
                "UPDATE \"Products\" SET \"InvoiceNumber\" = 'INV-' || REPLACE(\"Id\"::text, '-', '') WHERE \"InvoiceNumber\" = '';");

            migrationBuilder.CreateIndex(
                name: "IX_Products_InvoiceNumber",
                table: "Products",
                column: "InvoiceNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Products_InvoiceNumber",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "Products");
        }
    }
}
