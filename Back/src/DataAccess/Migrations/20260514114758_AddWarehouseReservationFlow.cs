using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddWarehouseReservationFlow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReservedProductId",
                table: "RequisitionItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "Products",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AddColumn<decimal>(
                name: "ReservedQuantity",
                table: "Products",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_RequisitionItems_ReservedProductId",
                table: "RequisitionItems",
                column: "ReservedProductId");

            migrationBuilder.AddForeignKey(
                name: "FK_RequisitionItems_Products_ReservedProductId",
                table: "RequisitionItems",
                column: "ReservedProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RequisitionItems_Products_ReservedProductId",
                table: "RequisitionItems");

            migrationBuilder.DropIndex(
                name: "IX_RequisitionItems_ReservedProductId",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "ReservedProductId",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "ReservedQuantity",
                table: "Products");

            migrationBuilder.AlterColumn<decimal>(
                name: "Quantity",
                table: "Products",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)",
                oldPrecision: 18,
                oldScale: 4);
        }
    }
}
