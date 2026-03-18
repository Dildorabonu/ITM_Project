using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class RefactorPermissionsToEnums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Permissions_Name",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Permissions");

            migrationBuilder.AddColumn<int>(
                name: "Action",
                table: "Permissions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Module",
                table: "Permissions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Module_Action",
                table: "Permissions",
                columns: new[] { "Module", "Action" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Permissions_Module_Action",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "Action",
                table: "Permissions");

            migrationBuilder.DropColumn(
                name: "Module",
                table: "Permissions");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Permissions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Permissions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Permissions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Name",
                table: "Permissions",
                column: "Name",
                unique: true);
        }
    }
}
