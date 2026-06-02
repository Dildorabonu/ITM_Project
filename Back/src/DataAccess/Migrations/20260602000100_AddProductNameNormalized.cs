using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductNameNormalized : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Mahsulot nomining kanonik (translit + normalize) ko'rinishi.
            // Mavjud yozuvlar dastur ishga tushganda TextNormalizer orqali to'ldiriladi.
            migrationBuilder.AddColumn<string>(
                name: "NameNormalized",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NameNormalized",
                table: "Products");
        }
    }
}
