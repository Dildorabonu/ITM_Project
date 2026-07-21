using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddCostNormItemDepartment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "CostNormItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CostNormItems_DepartmentId",
                table: "CostNormItems",
                column: "DepartmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_CostNormItems_Departments_DepartmentId",
                table: "CostNormItems",
                column: "DepartmentId",
                principalTable: "Departments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CostNormItems_Departments_DepartmentId",
                table: "CostNormItems");

            migrationBuilder.DropIndex(
                name: "IX_CostNormItems_DepartmentId",
                table: "CostNormItems");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "CostNormItems");
        }
    }
}
