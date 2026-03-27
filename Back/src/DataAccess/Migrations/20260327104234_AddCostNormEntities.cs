using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddCostNormEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CostNorms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CostNorms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CostNorms_Contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "Contracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CostNorms_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CostNormItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CostNormId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsSection = table.Column<bool>(type: "boolean", nullable: false),
                    SectionName = table.Column<string>(type: "text", nullable: true),
                    No = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: true),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    ReadyQty = table.Column<string>(type: "text", nullable: true),
                    WasteQty = table.Column<string>(type: "text", nullable: true),
                    TotalQty = table.Column<string>(type: "text", nullable: true),
                    PhotoRaw = table.Column<string>(type: "text", nullable: true),
                    PhotoSemi = table.Column<string>(type: "text", nullable: true),
                    ImportType = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CostNormItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CostNormItems_CostNorms_CostNormId",
                        column: x => x.CostNormId,
                        principalTable: "CostNorms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CostNormItems_CostNormId",
                table: "CostNormItems",
                column: "CostNormId");

            migrationBuilder.CreateIndex(
                name: "IX_CostNorms_ContractId",
                table: "CostNorms",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_CostNorms_CreatedBy",
                table: "CostNorms",
                column: "CreatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CostNormItems");

            migrationBuilder.DropTable(
                name: "CostNorms");
        }
    }
}
