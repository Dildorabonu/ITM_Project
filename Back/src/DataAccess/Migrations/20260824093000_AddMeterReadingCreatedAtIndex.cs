using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddMeterReadingCreatedAtIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Filtrsiz "oxirgi N o'lchov" so'rovi (ORDER BY "CreatedAt" DESC LIMIT n)
            // mavjud (DeviceName, CreatedAt) indeksidan foydalana olmaydi — bu indeks
            // faqat qurilma bo'yicha filtrlangan holatga xizmat qiladi.
            migrationBuilder.CreateIndex(
                name: "IX_MeterReadings_CreatedAt",
                table: "MeterReadings",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MeterReadings_CreatedAt",
                table: "MeterReadings");
        }
    }
}
