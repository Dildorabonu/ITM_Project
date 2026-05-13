using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceContractPriorityWithContractType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Priority",
                table: "Contracts",
                newName: "ContractType");

            // Old Priority values (Low=0, Medium=1, High=2, Urgent=3) do not
            // map to the new ContractType enum (Mahalliy=0, Tashqi=1).
            // Any value > 1 must be normalized; default everything to Mahalliy.
            migrationBuilder.Sql(@"UPDATE ""Contracts"" SET ""ContractType"" = 0 WHERE ""ContractType"" > 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ContractType",
                table: "Contracts",
                newName: "Priority");
        }
    }
}
