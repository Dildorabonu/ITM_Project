using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddProductLevelDepartmentsAndUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "TechProcesses",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContractProductDepartments",
                columns: table => new
                {
                    ContractProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractProductDepartments", x => new { x.ContractProductId, x.DepartmentId });
                    table.ForeignKey(
                        name: "FK_ContractProductDepartments_ContractProducts_ContractProduct~",
                        column: x => x.ContractProductId,
                        principalTable: "ContractProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ContractProductDepartments_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ContractProductUsers",
                columns: table => new
                {
                    ContractProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContractProductUsers", x => new { x.ContractProductId, x.UserId, x.Role });
                    table.ForeignKey(
                        name: "FK_ContractProductUsers_ContractProducts_ContractProductId",
                        column: x => x.ContractProductId,
                        principalTable: "ContractProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ContractProductUsers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContractProductDepartments_DepartmentId",
                table: "ContractProductDepartments",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ContractProductUsers_UserId",
                table: "ContractProductUsers",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContractProductDepartments");

            migrationBuilder.DropTable(
                name: "ContractProductUsers");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "TechProcesses");
        }
    }
}
