using Application.Licensing;
using Application.Options;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

/// <summary>
/// Token umuman bo'lmaganda beriladigan bepul sinov yo'li: mijoz serveriga tizim
/// o'rnatilganda (deploy paketda <c>License:Key</c> bo'sh) shu mantiq ishlaydi.
/// </summary>
public class LicenseServiceTrialTests : IDisposable
{
    private readonly string _stateDir;
    private readonly string _previousStateDir;

    public LicenseServiceTrialTests()
    {
        // Nusxa fayllari %ProgramData%/ITM ga yozilmasligi uchun vaqtinchalik katalogga yo'naltiramiz.
        _previousStateDir = LicenseService.StateDirectory;
        _stateDir = Path.Combine(Path.GetTempPath(), "itm-license-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_stateDir);
        LicenseService.StateDirectory = _stateDir;
    }

    public void Dispose()
    {
        LicenseService.StateDirectory = _previousStateDir;
        try { Directory.Delete(_stateDir, recursive: true); } catch { /* tozalab bo'lmasa ham test tugadi */ }
        GC.SuppressFinalize(this);
    }

    private static LicenseService Create(DatabaseContext db, int trialDays = 30, string key = "") =>
        new(db, OptionsHelper.Wrap(new LicenseOptions { Key = key, TrialDays = trialDays }), new LicenseGuard());

    private string TrialMirrorPath => Path.Combine(_stateDir, "trial.dat");

    private void WriteTrialMirror(DateTime startUtc) =>
        File.WriteAllText(TrialMirrorPath, startUtc.Ticks.ToString());

    private static void SeedState(DatabaseContext db, DateTime? trialStartUtc = null, DateTime? highWaterUtc = null)
    {
        db.LicenseStates.Add(new LicenseState
        {
            Id = LicenseState.SingletonId,
            HighWaterUtc = highWaterUtc ?? DateTime.UtcNow,
            TrialStartUtc = trialStartUtc,
            UpdatedAt = DateTime.UtcNow,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task WithoutToken_FirstRun_StartsThirtyDayTrial()
    {
        await using var db = TestDbContextFactory.Create();

        var status = await Create(db).RefreshAsync();

        status.Valid.Should().BeTrue();
        status.Reason.Should().Be("TRIAL");
        status.ExpiresUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(30), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task TrialStart_IsPersistedToBothDatabaseAndMirrorFile()
    {
        await using var db = TestDbContextFactory.Create();

        await Create(db).RefreshAsync();

        var state = db.LicenseStates.Single();
        state.TrialStartUtc.Should().NotBeNull();
        File.Exists(TrialMirrorPath).Should().BeTrue();
        new DateTime(long.Parse(File.ReadAllText(TrialMirrorPath)), DateTimeKind.Utc)
            .Should().BeCloseTo(state.TrialStartUtc!.Value, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task RepeatedEvaluation_DoesNotRestartOrExtendTheTrial()
    {
        await using var db = TestDbContextFactory.Create();
        var service = Create(db);

        var first = await service.RefreshAsync();
        var second = await service.RefreshAsync();

        second.ExpiresUtc.Should().Be(first.ExpiresUtc);
    }

    [Fact]
    public async Task WipedDatabase_ResumesTrialFromMirror_InsteadOfStartingOver()
    {
        // Mijoz bazani butunlay o'chirib qayta yaratsa ham sinov qaytadan boshlanmasligi kerak.
        var startedAt = DateTime.UtcNow.AddDays(-10);
        WriteTrialMirror(startedAt);

        await using var db = TestDbContextFactory.Create();

        var status = await Create(db).RefreshAsync();

        status.Reason.Should().Be("TRIAL");
        status.ExpiresUtc.Should().BeCloseTo(startedAt.AddDays(30), TimeSpan.FromMinutes(1));
        db.LicenseStates.Single().TrialStartUtc.Should().BeCloseTo(startedAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task ElapsedTrial_BlocksWithTrialExpired()
    {
        await using var db = TestDbContextFactory.Create();
        SeedState(db, trialStartUtc: DateTime.UtcNow.AddDays(-31));

        var status = await Create(db).RefreshAsync();

        status.Valid.Should().BeFalse();
        status.Reason.Should().Be("TRIAL_EXPIRED");
    }

    [Fact]
    public async Task TrialDisabled_BlocksWithNoKey()
    {
        await using var db = TestDbContextFactory.Create();

        var status = await Create(db, trialDays: 0).RefreshAsync();

        status.Valid.Should().BeFalse();
        status.Reason.Should().Be("NO_KEY");
        db.LicenseStates.Single().TrialStartUtc.Should().BeNull();
    }

    [Fact]
    public async Task InvalidToken_DoesNotFallBackToTrial()
    {
        // Aks holda imzosi buzilgan tokenni qo'yish 30 kunlik sinovni qayta ochib berardi.
        await using var db = TestDbContextFactory.Create();

        var status = await Create(db, key: "buzilgan.token").RefreshAsync();

        status.Valid.Should().BeFalse();
        status.Reason.Should().Be("INVALID");
        db.LicenseStates.Single().TrialStartUtc.Should().BeNull();
    }

    [Fact]
    public async Task ClockRolledBackDuringTrial_BlocksWithTamper()
    {
        await using var db = TestDbContextFactory.Create();
        SeedState(db, trialStartUtc: DateTime.UtcNow.AddDays(-1), highWaterUtc: DateTime.UtcNow.AddHours(49));

        var status = await Create(db).RefreshAsync();

        status.Valid.Should().BeFalse();
        status.Reason.Should().Be("TAMPER");
    }

    [Fact]
    public async Task RefreshAsync_PublishesStatusToTheGuard()
    {
        await using var db = TestDbContextFactory.Create();
        var guard = new LicenseGuard();
        var service = new LicenseService(db, OptionsHelper.Wrap(new LicenseOptions { TrialDays = 30 }), guard);

        var status = await service.RefreshAsync();

        guard.Status.Should().BeSameAs(status);
    }
}
