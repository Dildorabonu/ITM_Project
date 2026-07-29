using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddMeterReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MeterReadings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VoltagePhaseA = table.Column<double>(type: "double precision", nullable: false),
                    VoltagePhaseB = table.Column<double>(type: "double precision", nullable: false),
                    VoltagePhaseC = table.Column<double>(type: "double precision", nullable: false),
                    CurrentPhaseA = table.Column<double>(type: "double precision", nullable: false),
                    CurrentPhaseB = table.Column<double>(type: "double precision", nullable: false),
                    CurrentPhaseC = table.Column<double>(type: "double precision", nullable: false),
                    ActivePower = table.Column<double>(type: "double precision", nullable: false),
                    Frequency = table.Column<double>(type: "double precision", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeterReadings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MeterReadings_DeviceName_CreatedAt",
                table: "MeterReadings",
                columns: new[] { "DeviceName", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MeterReadings");
        }
    }
}
