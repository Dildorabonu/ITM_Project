using DataAccess.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Application.Tests.Infrastructure;

/// <summary>
/// Har test uchun unique nomli InMemory <see cref="DatabaseContext"/> yaratadi.
/// Shu orqali parallel ishlovchi testlar bir-biriga ta'sir qilmaydi.
/// </summary>
public static class TestDbContextFactory
{
    public static DatabaseContext Create(string? databaseName = null)
    {
        var name = databaseName ?? $"itm-tests-{Guid.NewGuid():N}";

        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase(name)
            .EnableSensitiveDataLogging()
            .Options;

        var context = new DatabaseContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// SQLite in-memory (real relational) <see cref="DatabaseContext"/>. Use when a test
    /// exercises code that calls relational-only APIs such as <c>ExecuteUpdateAsync</c> /
    /// <c>ExecuteDeleteAsync</c>, which the EF InMemory provider does not translate.
    /// Returned context owns the underlying <see cref="SqliteConnection"/>.
    /// </summary>
    public static DatabaseContext CreateSqlite()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseSqlite(connection)
            .EnableSensitiveDataLogging()
            .Options;

        var context = new SqliteDatabaseContext(options, connection);
        context.Database.EnsureCreated();
        return context;
    }

    private sealed class SqliteDatabaseContext(DbContextOptions<DatabaseContext> options, SqliteConnection connection)
        : DatabaseContext(options)
    {
        public override void Dispose()
        {
            base.Dispose();
            connection.Dispose();
        }

        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
