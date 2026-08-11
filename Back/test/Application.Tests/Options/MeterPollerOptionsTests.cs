using Application.Options;
using FluentAssertions;
using Xunit;

namespace Application.Tests.Options;

public class MeterPollerOptionsTests
{
    [Fact]
    public void ResolveDevices_WithDevicesArray_ReturnsOnlyEnabledOnes()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Enabled = true,
            Devices =
            [
                new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1", Enabled = true },
                new MeterDeviceOptions { Name = "DR201", Ip = "10.0.0.2", Enabled = false },
                new MeterDeviceOptions { Name = "DR202", Ip = "10.0.0.3", Enabled = true },
            ],
        };

        // Act
        var devices = options.ResolveDevices();

        // Assert
        devices.Select(d => d.Name).Should().Equal("DR134", "DR202");
    }

    [Fact]
    public void ResolveDevices_WithLegacySingleDeviceConfig_ReturnsOneDevice()
    {
        // Arrange — eski appsettings formati: Devices yo'q, yakka maydonlar to'ldirilgan
        var options = new MeterPollerOptions
        {
            Enabled = true,
            Ip = "192.168.30.222",
            Port = 502,
            SlaveId = 3,
            StartAddress = 100,
            RegisterCount = 55,
            PtRatio = 2.0,
            DeviceName = "DR134",
        };

        // Act
        var devices = options.ResolveDevices();

        // Assert
        devices.Should().HaveCount(1);
        devices[0].Name.Should().Be("DR134");
        devices[0].Ip.Should().Be("192.168.30.222");
        devices[0].SlaveId.Should().Be(3);
        devices[0].PtRatio.Should().Be(2.0);
    }

    [Fact]
    public void ResolveDevices_WithNoIpAndNoDevices_ReturnsEmpty()
    {
        // Arrange
        var options = new MeterPollerOptions { Enabled = true };

        // Act & Assert
        options.ResolveDevices().Should().BeEmpty();
    }

    [Fact]
    public void ResolveDevices_WithDeviceMissingIp_SkipsIt()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Devices =
            [
                new MeterDeviceOptions { Name = "Yaxshi", Ip = "10.0.0.1" },
                new MeterDeviceOptions { Name = "IPsiz", Ip = "" },
            ],
        };

        // Act & Assert
        options.ResolveDevices().Select(d => d.Name).Should().Equal("Yaxshi");
    }

    [Fact]
    public void ResolveDevices_WithDeviceMissingName_UsesIpAsName()
    {
        // Arrange
        var options = new MeterPollerOptions
        {
            Devices = [new MeterDeviceOptions { Name = "", Ip = "10.0.0.7" }],
        };

        // Act & Assert
        options.ResolveDevices()[0].Name.Should().Be("10.0.0.7");
    }

    [Fact]
    public void EffectiveInterval_WithDeviceOverride_PrefersDeviceValue()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 3 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1", IntervalSeconds = 10 };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(10);
    }

    [Fact]
    public void EffectiveInterval_WithoutOverride_UsesGlobalValue()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 3 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(3);
    }

    [Fact]
    public void EffectiveInterval_WithZeroOrNegative_ClampsToOneSecond()
    {
        // Arrange
        var options = new MeterPollerOptions { IntervalSeconds = 0 };
        var device = new MeterDeviceOptions { Name = "DR134", Ip = "10.0.0.1" };

        // Act & Assert
        options.EffectiveInterval(device).Should().Be(1);
    }
}
