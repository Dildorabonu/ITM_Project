using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class FixRequisitionContractDeleteBehavior : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Contracts_ContractId",
                table: "Requisitions");

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Contracts_ContractId",
                table: "Requisitions",
                column: "ContractId",
                principalTable: "Contracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Requisitions_Contracts_ContractId",
                table: "Requisitions");

            migrationBuilder.AddForeignKey(
                name: "FK_Requisitions_Contracts_ContractId",
                table: "Requisitions",
                column: "ContractId",
                principalTable: "Contracts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
