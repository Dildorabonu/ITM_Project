using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddRequisitionSignerFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SignDate",
                table: "Requisitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerName",
                table: "Requisitions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerTitle",
                table: "Requisitions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SignDate",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "SignerName",
                table: "Requisitions");

            migrationBuilder.DropColumn(
                name: "SignerTitle",
                table: "Requisitions");
        }
    }
}
