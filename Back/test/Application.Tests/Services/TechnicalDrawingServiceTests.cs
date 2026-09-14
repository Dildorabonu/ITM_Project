using Application.DTOs;
using Application.Helpers;
using Application.DTOs.TechnicalDrawings;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Moq;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class TechnicalDrawingServiceTests
{
    private static TechnicalDrawingService Sut(DatabaseContext db) =>
        new(db, new Mock<Application.Services.INotificationService>().Object);

    private static (Guid userId, Guid contractId) Seed(DatabaseContext db)
    {
        var user = TestData.SeedUser(db, "drw");

        // Contract A: 3 products, one already has a drawing -> 2 empty rows
        var ca = new Contract { Id = Guid.NewGuid(), ContractNo = "A-001", ContractParty = "P", IsActive = true, CreatedBy = user.Id };
        db.Contracts.Add(ca);
        var products = new List<ContractProduct>();
        for (var i = 0; i < 3; i++)
        {
            var p = new ContractProduct { Id = Guid.NewGuid(), ContractId = ca.Id, ProductType = $"PT{i}", Quantity = 1, Unit = "dona" };
            products.Add(p);
            db.ContractProducts.Add(p);
        }

        // Contract B: no products, no drawings -> 1 contract-level empty row
        var cb = new Contract { Id = Guid.NewGuid(), ContractNo = "B-002", ContractParty = "P", IsActive = true, CreatedBy = user.Id };
        db.Contracts.Add(cb);
        db.SaveChanges();

        // 1 drawing covering products[0], plus 2 drafts and 2 non-drafts
        var baseTime = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        db.TechnicalDrawings.Add(new TechnicalDrawing
        {
            Id = Guid.NewGuid(), ContractId = ca.Id, ContractProductId = products[0].Id,
            Title = "covering", Status = DrawingStatus.Approved, IsActive = true,
            CreatedBy = user.Id, CreatedAt = baseTime.AddHours(10),
        });
        for (var i = 0; i < 2; i++)
            db.TechnicalDrawings.Add(new TechnicalDrawing
            {
                Id = Guid.NewGuid(), ContractId = ca.Id, ContractProductId = null,
                Title = $"draft{i}", Status = DrawingStatus.Draft, IsActive = true,
                CreatedBy = user.Id, CreatedAt = baseTime.AddHours(i),
            });
        db.TechnicalDrawings.Add(new TechnicalDrawing
        {
            Id = Guid.NewGuid(), ContractId = ca.Id, ContractProductId = null,
            Title = "other1", Status = DrawingStatus.InProgress, IsActive = true,
            CreatedBy = user.Id, CreatedAt = baseTime.AddHours(5),
        });
        db.SaveChanges();
        return (user.Id, ca.Id);
    }

    // covering drawing hides products[0]; products[1],[2] -> 2 empty rows,
    // contract B has no products and no drawings -> 1 empty row. Total empty = 3.
    // drafts = 2, others = 2 (covering + other1). Grand total = 7.
    [Fact]
    public async Task Paging_WalksSegmentsInOrder_AndMatchesFullListing()
    {
        await using var db = TestDbContextFactory.CreateSqlite();
        var (userId, _) = Seed(db);
        var sut = Sut(db);

        var all = await sut.GetPagedAsync(userId, true, new PaginationParams { Page = 1, PageSize = 100 },
            null, null, null, null);
        all.Succeeded.Should().BeTrue();
        var allRows = all.Result!.Items.ToList();

        allRows.Should().HaveCount(7);
        all.Result.TotalCount.Should().Be(7);

        allRows.Take(3).Should().OnlyContain(r => r.Kind == TechnicalDrawingRowKind.Empty);
        allRows.Skip(3).Take(2).Should().OnlyContain(r => r.Drawing!.Status == DrawingStatus.Draft);
        allRows.Skip(5).Should().OnlyContain(r => r.Drawing!.Status != DrawingStatus.Draft);

        // Newest-first inside each drawing segment
        allRows.Skip(3).Take(2).Select(r => r.Drawing!.Title).Should().ContainInOrder("draft1", "draft0");
        allRows.Skip(5).Select(r => r.Drawing!.Title).Should().ContainInOrder("covering", "other1");

        // Walking page by page must reproduce the same sequence, including
        // pages that straddle a segment boundary.
        var walked = new List<TechnicalDrawingRowDto>();
        for (var page = 1; page <= 4; page++)
        {
            var res = await sut.GetPagedAsync(userId, true, new PaginationParams { Page = page, PageSize = 2 },
                null, null, null, null);
            res.Succeeded.Should().BeTrue();
            res.Result!.TotalCount.Should().Be(7);
            walked.AddRange(res.Result.Items);
        }

        walked.Should().HaveCount(7);
        walked.Select(Key).Should().Equal(allRows.Select(Key));
    }

    [Fact]
    public async Task OnlyMissing_ReturnsEmptyRowsOnly_AndStatusFilterExcludesThem()
    {
        await using var db = TestDbContextFactory.CreateSqlite();
        var (userId, _) = Seed(db);
        var sut = Sut(db);

        var missing = await sut.GetPagedAsync(userId, true, new PaginationParams { Page = 1, PageSize = 100 },
            null, null, true, null);
        missing.Result!.Items.Should().HaveCount(3);
        missing.Result.Items.Should().OnlyContain(r => r.Kind == TechnicalDrawingRowKind.Empty);

        var drafts = await sut.GetPagedAsync(userId, true, new PaginationParams { Page = 1, PageSize = 100 },
            null, DrawingStatus.Draft, null, null);
        drafts.Result!.Items.Should().HaveCount(2);
        drafts.Result.Items.Should().OnlyContain(r => r.Drawing!.Status == DrawingStatus.Draft);
    }

    [Fact]
    public async Task Search_FiltersBothEmptyRowsAndDrawings()
    {
        await using var db = TestDbContextFactory.CreateSqlite();
        var (userId, _) = Seed(db);
        var sut = Sut(db);

        var res = await sut.GetPagedAsync(userId, true, new PaginationParams { Page = 1, PageSize = 100 },
            search: "B-002", null, null, null);
        res.Result!.Items.Should().HaveCount(1);
        res.Result.Items.Single().Empty!.ContractNo.Should().Be("B-002");
    }

    private static string Key(TechnicalDrawingRowDto r) =>
        r.Kind == TechnicalDrawingRowKind.Empty
            ? $"E:{r.Empty!.ContractNo}:{r.Empty.ProductId}"
            : $"D:{r.Drawing!.Id}";
}
