using Xunit;

namespace Application.Tests;

public class SmokeTest
{
    [Fact]
    public void TestRunner_ShouldExecute_GreenAssertion()
    {
        // Arrange
        var canary = true;

        // Act
        // (smoke test — hech qanday haqiqiy logika yo'q)

        // Assert
        Assert.True(canary);
    }
}
