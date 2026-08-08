using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddRequisitionCompletedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Requisitions",
                type: "timestamp with time zone",
                nullable: true);

            // Bir martalik backfill: mavjud bajarilgan talabnomalarda aniq yakunlanish
            // vaqti saqlanmagan. Rejected (3) uchun yagona mavjud manba — direktor
            // qarori sanasi (rad etish o'zi ApprovedAt paytida sodir bo'ladi).
            // Released (11) / Delivered (12) uchun esa ApprovedAt haqiqiy chiqarish
            // vaqtidan doim oldinroq — real vaqt StockMovements jurnalida, Release
            // (5) turidagi harakatning eng kechki CreatedAt'i (ReleaseAsync shu turda
            // yozadi). Topilmasa (masalan tarixiy yozuv) ApprovedAt'ga qaytariladi.
            migrationBuilder.Sql("""
                UPDATE "Requisitions" r
                SET "CompletedAt" = COALESCE(
                    (SELECT max(sm."CreatedAt") FROM "StockMovements" sm
                     WHERE sm."RequisitionId" = r."Id" AND sm."Type" = 5),
                    r."ApprovedAt")
                WHERE r."Status" IN (11, 12) AND r."CompletedAt" IS NULL;

                UPDATE "Requisitions"
                SET "CompletedAt" = "ApprovedAt"
                WHERE "Status" = 3 AND "CompletedAt" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Requisitions");
        }
    }
}
