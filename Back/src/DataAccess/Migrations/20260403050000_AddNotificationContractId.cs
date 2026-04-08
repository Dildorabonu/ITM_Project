using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationContractId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ContractId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ContractId",
                table: "Notifications",
                column: "ContractId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Contracts_ContractId",
                table: "Notifications",
                column: "ContractId",
                principalTable: "Contracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Contracts_ContractId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_ContractId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ContractId",
                table: "Notifications");
        }
    }
}
