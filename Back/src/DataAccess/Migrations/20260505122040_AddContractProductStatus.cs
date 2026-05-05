using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddContractProductStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "ContractProducts",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            // Backfill product statuses from existing contract state, drawings,
            // tech processes and cost norms so the new per-product workflow
            // matches what users have already done.
            migrationBuilder.Sql(@"
                UPDATE ""ContractProducts"" cp
                SET ""Status"" = 6
                FROM ""Contracts"" c
                WHERE cp.""ContractId"" = c.""Id""
                  AND (c.""IsActive"" = false OR c.""Status"" = 6);

                UPDATE ""ContractProducts"" cp
                SET ""Status"" = 5
                FROM ""Contracts"" c
                WHERE cp.""ContractId"" = c.""Id""
                  AND c.""Status"" = 5
                  AND cp.""Status"" <> 6;

                UPDATE ""ContractProducts"" cp
                SET ""Status"" = 4
                WHERE cp.""Status"" = 1
                  AND EXISTS (
                      SELECT 1 FROM ""TechProcesses"" tp
                      WHERE tp.""ContractProductId"" = cp.""Id"" AND tp.""Status"" = 2
                  )
                  AND EXISTS (
                      SELECT 1 FROM ""CostNorms"" cn
                      WHERE cn.""ContractProductId"" = cp.""Id"" AND cn.""Status"" = 1
                  );

                UPDATE ""ContractProducts"" cp
                SET ""Status"" = 2
                WHERE cp.""Status"" = 1
                  AND (
                      EXISTS (SELECT 1 FROM ""TechProcesses"" tp WHERE tp.""ContractProductId"" = cp.""Id"")
                      OR EXISTS (
                          SELECT 1 FROM ""TechnicalDrawings"" td
                          WHERE td.""ContractProductId"" = cp.""Id"" AND td.""Status"" = 1
                      )
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "ContractProducts");
        }
    }
}
