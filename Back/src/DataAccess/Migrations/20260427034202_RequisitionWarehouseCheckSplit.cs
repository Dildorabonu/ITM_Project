using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class RequisitionWarehouseCheckSplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentRequisitionId",
                table: "Requisitions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Source",
                table: "Requisitions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WarehouseCheckedAt",
                table: "Requisitions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WarehouseCheckedBy",
                table: "Requisitions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AvailableQuantity",
                table: "RequisitionItems",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OriginalQuantity",
                table: "RequisitionItems",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WarehouseNotes",
                table: "RequisitionItems",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Requisitions_ParentRequisitionId",
                table: "Requisitions",
                column: "ParentRequisitionId");

            migrationBuilder.CreateIndex(
                name: "IX_Requisitions_WarehouseCheckedBy",
                table: "Requisitions",
                column: "WarehouseCheckedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Requisitions_ParentRequisitionId",
                table: "Requisitions",
                column: "ParentRequisitionId",
                principalTable: "Requisitions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Users_WarehouseCheckedBy",
                table: "Requisitions",
                column: "WarehouseCheckedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Requisitions_ParentRequisitionId",
                table: "Requisitions");

            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Users_WarehouseCheckedBy",
                table: "Requisitions");

            migrationBuilder.DropIndex(
                name: "IX_Requisitions_ParentRequisitionId",
                table: "Requisitions");

            migrationBuilder.DropIndex(
                name: "IX_Requisitions_WarehouseCheckedBy",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "ParentRequisitionId",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "WarehouseCheckedAt",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "WarehouseCheckedBy",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "AvailableQuantity",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "OriginalQuantity",
                table: "RequisitionItems");

            migrationBuilder.DropColumn(
                name: "WarehouseNotes",
                table: "RequisitionItems");
        }
    }
}
