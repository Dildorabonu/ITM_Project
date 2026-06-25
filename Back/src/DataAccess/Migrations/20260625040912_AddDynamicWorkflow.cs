using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddDynamicWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "WorkflowTemplateId",
                table: "Contracts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContractProductStages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ContractProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    StageType = table.Column<int>(type: "integer", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractProductStages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContractProductStages_ContractProducts_ContractProductId",
                        column: x => x.ContractProductId,
                        principalTable: "ContractProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowTemplates_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowTemplateStages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    StageType = table.Column<int>(type: "integer", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowTemplateStages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowTemplateStages_WorkflowTemplates_WorkflowTemplateId",
                        column: x => x.WorkflowTemplateId,
                        principalTable: "WorkflowTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Contracts_WorkflowTemplateId",
                table: "Contracts",
                column: "WorkflowTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractProductStages_ContractProductId_StageType",
                table: "ContractProductStages",
                columns: new[] { "ContractProductId", "StageType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTemplates_CreatedBy",
                table: "WorkflowTemplates",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTemplates_IsDefault",
                table: "WorkflowTemplates",
                column: "IsDefault",
                unique: true,
                filter: "\"IsDefault\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowTemplateStages_WorkflowTemplateId_StageType",
                table: "WorkflowTemplateStages",
                columns: new[] { "WorkflowTemplateId", "StageType" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Contracts_WorkflowTemplates_WorkflowTemplateId",
                table: "Contracts",
                column: "WorkflowTemplateId",
                principalTable: "WorkflowTemplates",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Contracts_WorkflowTemplates_WorkflowTemplateId",
                table: "Contracts");

            migrationBuilder.DropTable(
                name: "ContractProductStages");

            migrationBuilder.DropTable(
                name: "WorkflowTemplateStages");

            migrationBuilder.DropTable(
                name: "WorkflowTemplates");

            migrationBuilder.DropIndex(
                name: "IX_Contracts_WorkflowTemplateId",
                table: "Contracts");

            migrationBuilder.DropColumn(
                name: "WorkflowTemplateId",
                table: "Contracts");
        }
    }
}
