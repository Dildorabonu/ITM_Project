using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentBatchSourceBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceBatchId",
                table: "ShipmentBatches",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_SourceBatchId",
                table: "ShipmentBatches",
                column: "SourceBatchId");

            migrationBuilder.AddForeignKey(
                name: "FK_ShipmentBatches_ShipmentBatches_SourceBatchId",
                table: "ShipmentBatches",
                column: "SourceBatchId",
                principalTable: "ShipmentBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShipmentBatches_ShipmentBatches_SourceBatchId",
                table: "ShipmentBatches");

            migrationBuilder.DropIndex(
                name: "IX_ShipmentBatches_SourceBatchId",
                table: "ShipmentBatches");

            migrationBuilder.DropColumn(
                name: "SourceBatchId",
                table: "ShipmentBatches");
        }
    }
}
