using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddEnergyRollupAndTariff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EnergyTariffs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PricePerKwh = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EnergyTariffs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MeterEnergyHourly",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    HourUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Kwh = table.Column<double>(type: "double precision", nullable: false),
                    AvgPowerW = table.Column<double>(type: "double precision", nullable: false),
                    PeakPowerW = table.Column<double>(type: "double precision", nullable: false),
                    MinPowerW = table.Column<double>(type: "double precision", nullable: false),
                    AvgVoltage = table.Column<double>(type: "double precision", nullable: false),
                    SampleCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeterEnergyHourly", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EnergyTariffs_EffectiveFrom",
                table: "EnergyTariffs",
                column: "EffectiveFrom",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeterEnergyHourly_DeviceName_HourUtc",
                table: "MeterEnergyHourly",
                columns: new[] { "DeviceName", "HourUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeterEnergyHourly_HourUtc",
                table: "MeterEnergyHourly",
                column: "HourUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EnergyTariffs");

            migrationBuilder.DropTable(
                name: "MeterEnergyHourly");
        }
    }
}
