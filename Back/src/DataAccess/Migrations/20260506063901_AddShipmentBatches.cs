using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentBatches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShipmentBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractProductId = table.Column<Guid>(type: "uuid", nullable: true),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    BatchNo = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShipmentBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShipmentBatches_ContractProducts_ContractProductId",
                        column: x => x.ContractProductId,
                        principalTable: "ContractProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShipmentBatches_Contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "Contracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShipmentBatches_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ShipmentBatches_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_ContractId_ContractProductId_BatchNo",
                table: "ShipmentBatches",
                columns: new[] { "ContractId", "ContractProductId", "BatchNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_ContractProductId",
                table: "ShipmentBatches",
                column: "ContractProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_CreatedBy",
                table: "ShipmentBatches",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ShipmentBatches_DepartmentId",
                table: "ShipmentBatches",
                column: "DepartmentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShipmentBatches");
        }
    }
}
