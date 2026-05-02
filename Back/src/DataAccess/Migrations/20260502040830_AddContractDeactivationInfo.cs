using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddContractDeactivationInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeactivatedAt",
                table: "Contracts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeactivationNote",
                table: "Contracts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeactivationReason",
                table: "Contracts",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeactivatedAt",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DeactivationNote",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "DeactivationReason",
                table: "Contracts");
        }
    }
}
