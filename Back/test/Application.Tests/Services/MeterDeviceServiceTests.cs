using Application.DTOs.Energy;
using Application.Options;
using Application.Services;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class MeterDeviceServiceTests
{
    private static MeterDeviceService CreateSut(DatabaseContext db, MeterDeviceSignal? signal = null) =>
        new(db, signal ?? new MeterDeviceSignal());

    private static MeterDeviceSaveDto SaveDto(string name = "DR134", string ip = "192.168.30.222",
        int port = 502, int slaveId = 1) => new()
    {
        Name = name,
        Ip = ip,
        Port = port,
        SlaveId = slaveId,
    };

    private static MeterDevice SeedDevice(DatabaseContext db, string name, string ip, int slaveId = 1)
    {
        var device = new MeterDevice
        {
            Id = Guid.NewGuid(),
            Name = name,
            Ip = ip,
            SlaveId = slaveId,
        };

        db.MeterDevices.Add(device);
        db.SaveChanges();
        return device;
    }

    private static void SeedReading(DatabaseContext db, string device)
    {
        db.MeterReadings.Add(new MeterReading
        {
            Id = Guid.NewGuid(),
            DeviceName = device,
            VoltagePhaseA = 230,
            ActivePower = 1000,
            Frequency = 50,
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsTrimmedDeviceWithDefaults()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(name: "  DR134 ", ip: " 192.168.30.222 "));

        // Assert
        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        var saved = await db.MeterDevices.SingleAsync();
        saved.Name.Should().Be("DR134");
        saved.Ip.Should().Be("192.168.30.222");
        saved.StartAddress.Should().Be(100);
        saved.RegisterCount.Should().Be(55);
        saved.PtRatio.Should().Be(1.0);
        saved.Enabled.Should().BeTrue();
    }

    [Theory]
    [InlineData("192.168.1")]
    [InlineData("5")]
    [InlineData("300.1.1.1")]
    [InlineData("meter.local")]
    [InlineData("")]
    public async Task CreateAsync_WithInvalidIp_ReturnsFailure(string ip)
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(ip: ip));

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        (await db.MeterDevices.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_WithTooFewRegisters_ReturnsFailure()
    {
        // Arrange — poller reg[50] ni o'qiydi, 50 ta registr yetmaydi
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var dto = SaveDto();
        dto.RegisterCount = 50;

        // Act
        var result = await sut.CreateAsync(dto);

        // Assert
        result.Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task CreateAsync_WithEmptyName_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(name: "   "));

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("nomi");
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateName_ReturnsFailure()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDevice(db, "DR134", "10.0.0.1");
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(name: "DR134", ip: "10.0.0.2"));

        // Assert
        result.Succeeded.Should().BeFalse();
        (await db.MeterDevices.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_WithSameIpPortAndSlaveId_ReturnsFailureNamingExistingDevice()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDevice(db, "DR134", "10.0.0.1");
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(name: "DR201", ip: "10.0.0.1"));

        // Assert
        result.Succeeded.Should().BeFalse();
        result.Errors.Single().Should().Contain("DR134");
    }

    [Fact]
    public async Task CreateAsync_WithSameIpButDifferentSlaveId_Succeeds()
    {
        // Arrange — bitta Modbus gateway ortidagi ikkinchi hisoblagich
        await using var db = TestDbContextFactory.Create();
        SeedDevice(db, "DR134", "10.0.0.1", slaveId: 1);
        var sut = CreateSut(db);

        // Act
        var result = await sut.CreateAsync(SaveDto(name: "DR201", ip: "10.0.0.1", slaveId: 2));

        // Assert
        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_RenameWithoutReadings_Succeeds()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var device = SeedDevice(db, "DR13", "10.0.0.1");
        var sut = CreateSut(db);

        // Act
        var result = await sut.UpdateAsync(device.Id, SaveDto(name: "DR134", ip: "10.0.0.1"));

        // Assert
        result.Succeeded.Should().BeTrue();
        (await db.MeterDevices.SingleAsync()).Name.Should().Be("DR134");
    }

    [Fact]
    public async Task UpdateAsync_RenameAfterReadings_ReturnsFailure()
    {
        // Arrange — o'lchovlar eski nom bilan yozilgan
        await using var db = TestDbContextFactory.Create();
        var device = SeedDevice(db, "DR134", "10.0.0.1");
        SeedReading(db, "DR134");
        var sut = CreateSut(db);

        // Act
        var result = await sut.UpdateAsync(device.Id, SaveDto(name: "DR999", ip: "10.0.0.1"));

        // Assert
        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        (await db.MeterDevices.SingleAsync()).Name.Should().Be("DR134");
    }

    [Fact]
    public async Task UpdateAsync_ChangeIpAfterReadings_Succeeds()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var device = SeedDevice(db, "DR134", "10.0.0.1");
        SeedReading(db, "DR134");
        var sut = CreateSut(db);

        // Act
        var result = await sut.UpdateAsync(device.Id, SaveDto(name: "DR134", ip: "10.0.0.50"));

        // Assert
        result.Succeeded.Should().BeTrue();
        var saved = await db.MeterDevices.SingleAsync();
        saved.Ip.Should().Be("10.0.0.50");
        saved.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task UpdateAsync_WithUnknownId_ReturnsNotFound()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        // Act
        var result = await sut.UpdateAsync(Guid.NewGuid(), SaveDto());

        // Assert
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteAsync_SoftDeletes_AndFreesNameForNewDevice()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var device = SeedDevice(db, "DR134", "10.0.0.1");
        var sut = CreateSut(db);

        // Act
        var deleted = await sut.DeleteAsync(device.Id);
        var recreated = await sut.CreateAsync(SaveDto(name: "DR134", ip: "10.0.0.1"));

        // Assert
        deleted.Succeeded.Should().BeTrue();
        recreated.Succeeded.Should().BeTrue();
        (await db.MeterDevices.CountAsync()).Should().Be(2);
        (await db.MeterDevices.FindAsync(device.Id))!.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAllAsync_ExcludesDeleted_AndFlagsDevicesWithReadings()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        SeedDevice(db, "DR134", "10.0.0.1");
        SeedDevice(db, "DR201", "10.0.0.2");
        var gone = SeedDevice(db, "DR300", "10.0.0.3");
        gone.DeletedAt = DateTime.UtcNow;
        db.SaveChanges();
        SeedReading(db, "DR134");
        var sut = CreateSut(db);

        // Act
        var result = await sut.GetAllAsync();

        // Assert
        var list = result.Result!.ToList();
        list.Select(d => d.Name).Should().Equal("DR134", "DR201");
        list.Single(d => d.Name == "DR134").HasReadings.Should().BeTrue();
        list.Single(d => d.Name == "DR201").HasReadings.Should().BeFalse();
    }

    [Fact]
    public async Task GetPollTargetsAsync_ReturnsOnlyEnabledAndNotDeleted()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var active = SeedDevice(db, "DR134", "10.0.0.1");
        var disabled = SeedDevice(db, "DR201", "10.0.0.2");
        disabled.Enabled = false;
        var deleted = SeedDevice(db, "DR300", "10.0.0.3");
        deleted.DeletedAt = DateTime.UtcNow;
        db.SaveChanges();
        var sut = CreateSut(db);

        // Act
        var targets = await sut.GetPollTargetsAsync();

        // Assert
        targets.Should().ContainSingle().Which.Id.Should().Be(active.Id);
    }

    [Fact]
    public async Task ImportFromConfigAsync_IntoEmptyTable_ImportsDevicesSkippingDuplicateNames()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);
        var config = new MeterPollerOptions
        {
            Devices =
            [
                new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" },
                new MeterDeviceOptions { Ip = "10.0.0.7", SlaveId = 1 },
                new MeterDeviceOptions { Ip = "10.0.0.7", SlaveId = 2 },
            ],
        }.ResolveDevices();

        // Act
        var imported = await sut.ImportFromConfigAsync(config);

        // Assert
        imported.Should().Be(2);
        (await db.MeterDevices.Select(d => d.Name).ToListAsync())
            .Should().BeEquivalentTo(["DR134", "10.0.0.7"]);
    }

    [Fact]
    public async Task ImportFromConfigAsync_WhenOnlyDeletedDevicesExist_DoesNothing()
    {
        // Arrange — administrator hamma qurilmani UI dan o'chirgan
        await using var db = TestDbContextFactory.Create();
        var deleted = SeedDevice(db, "DR134", "10.0.0.1");
        deleted.DeletedAt = DateTime.UtcNow;
        db.SaveChanges();
        var sut = CreateSut(db);

        // Act
        var imported = await sut.ImportFromConfigAsync(
            [new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" }]);

        // Assert
        imported.Should().Be(0);
        (await db.MeterDevices.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_WhenSucceeded_SignalsPoller()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var signal = new MeterDeviceSignal();
        var sut = CreateSut(db, signal);

        // Act
        await sut.CreateAsync(SaveDto());

        // Assert
        (await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None)).Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_WhenFailed_DoesNotSignalPoller()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var signal = new MeterDeviceSignal();
        var sut = CreateSut(db, signal);

        // Act
        await sut.CreateAsync(SaveDto(ip: "not-an-ip"));

        // Assert
        (await signal.WaitAsync(TimeSpan.Zero, CancellationToken.None)).Should().BeFalse();
    }
}
