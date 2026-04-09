using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddRequisitionFreeTextItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "MaterialId",
                table: "RequisitionItems",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "FreeTextName",
                table: "RequisitionItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FreeTextSpec",
                table: "RequisitionItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FreeTextUnit",
                table: "RequisitionItems",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FreeTextName",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "FreeTextSpec",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "FreeTextUnit",
                table: "RequisitionItems");

            migrationBuilder.AlterColumn<Guid>(
                name: "MaterialId",
                table: "RequisitionItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
