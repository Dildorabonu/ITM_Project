using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentBatchKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShipmentBatches_ContractId_ContractProductId_BatchNo",
                table: "ShipmentBatches");

            // Mavjud yozuvlar vazifalardan yuborilgan partiyalar —
            // ShipmentBatchKind.Production (1) deb belgilanadi.
            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "ShipmentBatches",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_ContractId_ContractProductId_Kind_BatchNo",
                table: "ShipmentBatches",
                columns: new[] { "ContractId", "ContractProductId", "Kind", "BatchNo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShipmentBatches_ContractId_ContractProductId_Kind_BatchNo",
                table: "ShipmentBatches");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "ShipmentBatches");

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_ContractId_ContractProductId_BatchNo",
                table: "ShipmentBatches",
                columns: new[] { "ContractId", "ContractProductId", "BatchNo" },
                unique: true);
        }
    }
}
