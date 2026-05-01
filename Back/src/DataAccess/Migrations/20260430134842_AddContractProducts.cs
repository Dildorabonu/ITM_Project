using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddContractProducts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Wipe all existing contracts (and cascading children) so the new product-based schema starts clean.
            // Null out non-cascading FK references first — some local DBs have RESTRICT on these columns
            // even though the model declares SetNull, so DELETE would otherwise fail.
            migrationBuilder.Sql("UPDATE \"Requisitions\" SET \"ContractId\" = NULL WHERE \"ContractId\" IS NOT NULL;");
            migrationBuilder.Sql("UPDATE \"ManufacturedProducts\" SET \"ContractId\" = NULL WHERE \"ContractId\" IS NOT NULL;");
            migrationBuilder.Sql("UPDATE \"Notifications\" SET \"ContractId\" = NULL WHERE \"ContractId\" IS NOT NULL;");
            migrationBuilder.Sql("DELETE FROM \"Contracts\";");

            migrationBuilder.DropColumn(
                name: "ProductType",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "Unit",
                table: "Contracts");

            migrationBuilder.AddColumn<Guid>(
                name: "ContractProductId",
                table: "TechProcesses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContractProductId",
                table: "TechnicalDrawings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContractProductId",
                table: "CostNorms",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ContractProductId",
                table: "ContractTasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContractProducts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductType = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractProducts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContractProducts_Contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "Contracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TechProcesses_ContractProductId",
                table: "TechProcesses",
                column: "ContractProductId");

            migrationBuilder.CreateIndex(
                name: "IX_TechnicalDrawings_ContractProductId",
                table: "TechnicalDrawings",
                column: "ContractProductId");

            migrationBuilder.CreateIndex(
                name: "IX_CostNorms_ContractProductId",
                table: "CostNorms",
                column: "ContractProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractTasks_ContractProductId",
                table: "ContractTasks",
                column: "ContractProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractProducts_ContractId",
                table: "ContractProducts",
                column: "ContractId");

            migrationBuilder.AddForeignKey(
                name: "FK_ContractTasks_ContractProducts_ContractProductId",
                table: "ContractTasks",
                column: "ContractProductId",
                principalTable: "ContractProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_CostNorms_ContractProducts_ContractProductId",
                table: "CostNorms",
                column: "ContractProductId",
                principalTable: "ContractProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TechnicalDrawings_ContractProducts_ContractProductId",
                table: "TechnicalDrawings",
                column: "ContractProductId",
                principalTable: "ContractProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_TechProcesses_ContractProducts_ContractProductId",
                table: "TechProcesses",
                column: "ContractProductId",
                principalTable: "ContractProducts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ContractTasks_ContractProducts_ContractProductId",
                table: "ContractTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_CostNorms_ContractProducts_ContractProductId",
                table: "CostNorms");

            migrationBuilder.DropForeignKey(
                name: "FK_TechnicalDrawings_ContractProducts_ContractProductId",
                table: "TechnicalDrawings");

            migrationBuilder.DropForeignKey(
                name: "FK_TechProcesses_ContractProducts_ContractProductId",
                table: "TechProcesses");

            migrationBuilder.DropTable(
                name: "ContractProducts");

            migrationBuilder.DropIndex(
                name: "IX_TechProcesses_ContractProductId",
                table: "TechProcesses");

            migrationBuilder.DropIndex(
                name: "IX_TechnicalDrawings_ContractProductId",
                table: "TechnicalDrawings");

            migrationBuilder.DropIndex(
                name: "IX_CostNorms_ContractProductId",
                table: "CostNorms");

            migrationBuilder.DropIndex(
                name: "IX_ContractTasks_ContractProductId",
                table: "ContractTasks");

            migrationBuilder.DropColumn(
                name: "ContractProductId",
                table: "TechProcesses");

            migrationBuilder.DropColumn(
                name: "ContractProductId",
                table: "TechnicalDrawings");

            migrationBuilder.DropColumn(
                name: "ContractProductId",
                table: "CostNorms");

            migrationBuilder.DropColumn(
                name: "ContractProductId",
                table: "ContractTasks");

            migrationBuilder.AddColumn<string>(
                name: "ProductType",
                table: "Contracts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "Contracts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Unit",
                table: "Contracts",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
