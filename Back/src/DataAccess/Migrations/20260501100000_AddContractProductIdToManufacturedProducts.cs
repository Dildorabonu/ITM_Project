using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddContractProductIdToManufacturedProducts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContractProductId",
                table: "ManufacturedProducts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ManufacturedProducts_ContractProductId",
                table: "ManufacturedProducts",
                column: "ContractProductId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ManufacturedProducts_ContractProducts_ContractProductId",
                table: "ManufacturedProducts",
                column: "ContractProductId",
                principalTable: "ContractProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ManufacturedProducts_ContractProducts_ContractProductId",
                table: "ManufacturedProducts");

            migrationBuilder.DropIndex(
                name: "IX_ManufacturedProducts_ContractProductId",
                table: "ManufacturedProducts");

            migrationBuilder.DropColumn(
                name: "ContractProductId",
                table: "ManufacturedProducts");
        }
    }
}
