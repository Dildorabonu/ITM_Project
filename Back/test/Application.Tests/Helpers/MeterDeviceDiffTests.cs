using Application.Helpers;
using Application.Options;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Helpers;

public class MeterDeviceDiffTests
{
    private const int GlobalInterval = 3;

    private static MeterDeviceOptions Device(Guid id, string ip = "10.0.0.1", int? interval = null) => new()
    {
        Id = id,
        Name = "DR134",
        Ip = ip,
        IntervalSeconds = interval,
    };

    private static Dictionary<Guid, string> Running(params MeterDeviceOptions[] devices) =>
        devices.ToDictionary(d => d.Id, d => MeterDeviceDiff.Fingerprint(d, GlobalInterval));

    [Fact]
    public void Compute_WithNewDevice_StartsIt()
    {
        // Arrange
        var device = Device(Guid.NewGuid());

        // Act
        var (toStop, toStart) = MeterDeviceDiff.Compute(Running(), [device], GlobalInterval);

        // Assert
        toStop.Should().BeEmpty();
        toStart.Should().ContainSingle().Which.Should().BeSameAs(device);
    }

    [Fact]
    public void Compute_WithRemovedDevice_StopsIt()
    {
        // Arrange
        var device = Device(Guid.NewGuid());

        // Act
        var (toStop, toStart) = MeterDeviceDiff.Compute(Running(device), [], GlobalInterval);

        // Assert
        toStop.Should().Equal(device.Id);
        toStart.Should().BeEmpty();
    }

    [Fact]
    public void Compute_WithChangedIp_RestartsDevice()
    {
        // Arrange
        var id = Guid.NewGuid();
        var running = Running(Device(id, ip: "10.0.0.1"));

        // Act
        var (toStop, toStart) = MeterDeviceDiff.Compute(running, [Device(id, ip: "10.0.0.50")], GlobalInterval);

        // Assert
        toStop.Should().Equal(id);
        toStart.Should().ContainSingle().Which.Ip.Should().Be("10.0.0.50");
    }

    [Fact]
    public void Compute_WithUnchangedDevice_LeavesItRunning()
    {
        // Arrange
        var id = Guid.NewGuid();
        var running = Running(Device(id));

        // Act
        var (toStop, toStart) = MeterDeviceDiff.Compute(running, [Device(id)], GlobalInterval);

        // Assert
        toStop.Should().BeEmpty();
        toStart.Should().BeEmpty();
    }

    [Fact]
    public void Compute_WithIntervalSetToGlobalValue_LeavesItRunning()
    {
        // Arrange — amaldagi davr o'zgarmagan (null → global 3 va aniq 3 bir xil)
        var id = Guid.NewGuid();
        var running = Running(Device(id, interval: null));

        // Act
        var (toStop, toStart) = MeterDeviceDiff.Compute(running, [Device(id, interval: GlobalInterval)], GlobalInterval);

        // Assert
        toStop.Should().BeEmpty();
        toStart.Should().BeEmpty();
    }
}
