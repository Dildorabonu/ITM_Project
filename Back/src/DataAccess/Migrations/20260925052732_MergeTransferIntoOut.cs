using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class MergeTransferIntoOut : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Transfer (2) → Out (1): ko'chirish endi alohida tur emas, chiqim deb yuritiladi.
            migrationBuilder.Sql(@"UPDATE ""StockMovements"" SET ""Type"" = 1 WHERE ""Type"" = 2;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Eski chiqim (sarf) maqsad bo'limsiz yozilgan, ko'chirish esa doim maqsad bo'lim bilan —
            // shu belgi bo'yicha ajratib qaytarish mumkin.
            migrationBuilder.Sql(@"UPDATE ""StockMovements"" SET ""Type"" = 2 WHERE ""Type"" = 1 AND ""TargetDepartmentId"" IS NOT NULL;");
        }
    }
}
