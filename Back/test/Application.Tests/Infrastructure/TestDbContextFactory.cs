using DataAccess.Persistence;
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
}
