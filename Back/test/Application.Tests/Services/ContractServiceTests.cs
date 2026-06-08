using Application.DTOs.Contracts;
using Application.Services;
using Application.Services.Impl;
using Application.Tests.Infrastructure;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using Task = System.Threading.Tasks.Task;

namespace Application.Tests.Services;

public class ContractServiceTests
{
    // ─────────────────────────────────────────────────────────────────────
    //  Infrastructure
    // ─────────────────────────────────────────────────────────────────────

    private sealed record SutBundle(
        ContractService Service,
        Mock<INotificationService> Notifications,
        Mock<IManufacturedProductService> Manufactured,
        Mock<IActivityLogService> ActivityLog);

    private static SutBundle CreateSut(DatabaseContext db)
    {
        var notifications = new Mock<INotificationService>();
        var manufactured = new Mock<IManufacturedProductService>();
        var activityLog = new Mock<IActivityLogService>();
        var service = new ContractService(db, notifications.Object, manufactured.Object, activityLog.Object);
        return new SutBundle(service, notifications, manufactured, activityLog);
    }

    private static Department SeedDept(
        DatabaseContext db,
        string name = "Sex-1",
        DepartmentType type = DepartmentType.Bolim,
        bool isActive = true,
        Guid? id = null)
    {
        var d = new Department
        {
            Id = id ?? Guid.NewGuid(),
            Name = name,
            Type = type,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.Departments.Add(d);
        db.SaveChanges();
        return d;
    }

    private static User SeedUser(
        DatabaseContext db,
        Guid departmentId,
        string login = "user",
        bool isActive = true,
        Guid? id = null)
    {
        var u = new User
        {
            Id = id ?? Guid.NewGuid(),
            Login = login,
            FirstName = "First",
            LastName = "Last",
            PasswordHash = "hash",
            DepartmentId = departmentId,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(u);
        db.SaveChanges();
        return u;
    }

    /// <summary>
    /// Sets up a contract with a single active product so status-transition tests
    /// have something for the recompute/aggregate logic to chew on.
    /// </summary>
    private static (Contract Contract, ContractProduct Product) SeedContractWithProduct(
        DatabaseContext db,
        ContractStatus status = ContractStatus.DrawingPending,
        ContractProductStatus productStatus = ContractProductStatus.DrawingPending,
        bool isActive = true,
        string contractNo = "C-2026-001")
    {
        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = contractNo,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6)),
            ContractType = ContractType.Mahalliy,
            ContractParty = "Partner",
            Status = status,
            IsActive = isActive,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Contracts.Add(contract);

        var product = new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductType = "Eshik",
            Quantity = 10,
            Unit = "dona",
            OrderIndex = 0,
            Status = productStatus,
            IsActive = isActive,
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractProducts.Add(product);
        db.SaveChanges();
        return (contract, product);
    }

    private static ContractProductCreateDto MakeProductDto(
        string productType = "Eshik",
        int quantity = 5,
        string unit = "dona",
        List<Guid>? departmentIds = null,
        List<ContractProductUserAssignItem>? users = null) => new()
        {
            ProductType = productType,
            Quantity = quantity,
            Unit = unit,
            DepartmentIds = departmentIds ?? [],
            Users = users ?? [],
        };

    // ─────────────────────────────────────────────────────────────────────
    //  CreateAsync — happy path & basic persistence
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidDto_PersistsContractAndProducts_AndReturns201()
    {
        // Arrange
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db, name: "Sex-1");
        var creator = Guid.NewGuid();
        var sut = CreateSut(db);

        var dto = new ContractCreateDto
        {
            ContractNo = "C-2026-001",
            StartDate = new DateOnly(2026, 1, 1),
            EndDate   = new DateOnly(2026, 12, 31),
            ContractType = ContractType.Mahalliy,
            ContractParty = "ABC partner",
            Notes = "Test notes",
            DepartmentIds = [dept.Id],
            Products =
            [
                MakeProductDto(productType: "Eshik", quantity: 10, unit: "dona",
                    departmentIds: [dept.Id]),
                MakeProductDto(productType: "Deraza", quantity: 5, unit: "dona",
                    departmentIds: [dept.Id]),
            ],
        };

        // Act
        var result = await sut.Service.CreateAsync(dto, creator);

        // Assert
        result.Succeeded.Should().BeTrue();
        result.StatusCode.Should().Be(201);
        result.Result!.Products.Should().HaveCount(2);
        result.Result.Products.Select(p => p.OrderIndex).Should().Equal(0, 1);

        var saved = db.Contracts
            .Include(c => c.Products)
            .Include(c => c.ContractDepartments)
            .Single();
        saved.ContractNo.Should().Be("C-2026-001");
        saved.ContractParty.Should().Be("ABC partner");
        saved.Status.Should().Be(ContractStatus.DrawingPending,
            "yangi shartnoma har doim DrawingPending'dan boshlanadi");
        saved.CreatedBy.Should().Be(creator);
        saved.Products.Should().HaveCount(2);
        saved.Products.OrderBy(p => p.OrderIndex).Select(p => p.ProductType)
            .Should().Equal("Eshik", "Deraza");
        saved.ContractDepartments.Should().ContainSingle(cd => cd.DepartmentId == dept.Id);
    }

    [Fact]
    public async Task CreateAsync_DuplicateActiveContractNo_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        SeedContractWithProduct(db, contractNo: "C-DUP");
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-DUP",
            ContractParty = "X",
            ContractType = ContractType.Mahalliy,
            DepartmentIds = [dept.Id],
            Products = [MakeProductDto(departmentIds: [dept.Id])],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("«C-DUP»").And.Contain("allaqachon mavjud");
        db.Contracts.Count().Should().Be(1, "yangi yaratilmagan bo'lishi kerak");
    }

    [Fact]
    public async Task CreateAsync_SameContractNo_WhenExistingIsInactive_Succeeds()
    {
        // Arxivga ko'chgan eski shartnoma bilan bir xil raqamga ruxsat — bu
        // ActivateAsync dagi qarama-qarshilik tekshiruvi bilan muvozanatda.
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        SeedContractWithProduct(db, contractNo: "C-OLD", isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-OLD",
            ContractParty = "Y",
            ContractType = ContractType.Mahalliy,
            DepartmentIds = [dept.Id],
            Products = [MakeProductDto(departmentIds: [dept.Id])],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.Contracts.Count(c => c.ContractNo == "C-OLD").Should().Be(2);
    }

    [Fact]
    public async Task CreateAsync_ProductWithZeroQuantity_ReturnsValidationError()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [dept.Id],
            Products = [MakeProductDto(quantity: 0, departmentIds: [dept.Id])],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle().Which.Should().Contain("miqdor");
        db.Contracts.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_ProductWithEmptyUnit_ReturnsValidationError()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [dept.Id],
            Products = [MakeProductDto(unit: "", departmentIds: [dept.Id])],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("birlig");
    }

    [Fact]
    public async Task CreateAsync_ProductWithEmptyProductType_IsSilentlySkipped()
    {
        // Bo'sh nomli ContractProductCreateDto — yaratish jarayonida o'tkazib yuboriladi
        // (validation xatosi qaytarilmaydi, lekin bunday qator DB ga yozilmaydi).
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [dept.Id],
            Products =
            [
                MakeProductDto(productType: "Real", departmentIds: [dept.Id]),
                MakeProductDto(productType: "   ", departmentIds: [dept.Id]),
            ],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        var contract = db.Contracts.Include(c => c.Products).Single();
        contract.Products.Should().ContainSingle()
            .Which.ProductType.Should().Be("Real");
    }

    [Fact]
    public async Task CreateAsync_WithNoValidProducts_ReturnsValidationError_AndCreatesNothing()
    {
        // Faqat bo'sh ProductType li qatorlar — bitta ham to'g'ri mahsulot yo'q.
        // Orphan (mahsulotsiz) shartnoma yaratilmasligi kerak.
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-EMPTY",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [dept.Id],
            Products =
            [
                MakeProductDto(productType: "   ", departmentIds: [dept.Id]),
                MakeProductDto(productType: "", departmentIds: [dept.Id]),
            ],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().Contain(e => e.Contains("kamida bitta"));
        db.Contracts.Should().BeEmpty("orphan shartnoma yaratilmasligi kerak");
    }

    [Fact]
    public async Task CreateAsync_WithEmptyProductList_ReturnsValidationError()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-EMPTY2",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [],
            Products = [],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("kamida bitta"));
        db.Contracts.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_MissingDepartment_ReturnsValidationError()
    {
        await using var db = TestDbContextFactory.Create();
        var phantomDept = Guid.NewGuid();
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            Products = [MakeProductDto(departmentIds: [phantomDept])],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Bo'lim topilmadi");
    }

    [Fact]
    public async Task CreateAsync_AssignedUser_NotInProductDepartment_ReturnsValidationError()
    {
        // Responsible/Supervisor xodim mahsulotning bo'limlaridan biriga tegishli
        // bo'lishi kerak. Aks holda servis xato qaytaradi.
        await using var db = TestDbContextFactory.Create();
        var deptA = SeedDept(db, name: "A");
        var deptB = SeedDept(db, name: "B");
        var userInB = SeedUser(db, deptB.Id, login: "ub");
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            Products =
            [
                MakeProductDto(
                    departmentIds: [deptA.Id],
                    users:
                    [
                        new ContractProductUserAssignItem
                        {
                            UserId = userInB.Id,
                            Role = ContractUserRole.Responsible,
                        },
                    ]),
            ],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle()
            .Which.Should().Contain("tanlangan bo'limlardan emas");
    }

    [Fact]
    public async Task CreateAsync_ObserverRole_SkipsDepartmentMembershipCheck()
    {
        // Boshqaruv/Observer xodim har qanday bo'limdan bo'lishi mumkin.
        await using var db = TestDbContextFactory.Create();
        var deptA = SeedDept(db, name: "A");
        var deptB = SeedDept(db, name: "B");
        var observer = SeedUser(db, deptB.Id, login: "obs", isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            Products =
            [
                MakeProductDto(
                    departmentIds: [deptA.Id],
                    users:
                    [
                        new ContractProductUserAssignItem
                        {
                            UserId = observer.Id,
                            Role = ContractUserRole.Observer,
                        },
                    ]),
            ],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        db.ContractProductUsers.Should().ContainSingle()
            .Which.UserId.Should().Be(observer.Id);
    }

    [Fact]
    public async Task CreateAsync_MirrorsProductDepartmentsIntoContractDepartments()
    {
        // Per-product bo'limlar shartnoma darajasidagi ContractDepartments ga
        // union qilib yoziladi — legacy visibility query lari shu kanal orqali
        // ishlaydi.
        await using var db = TestDbContextFactory.Create();
        var deptA = SeedDept(db, name: "A");
        var deptB = SeedDept(db, name: "B");
        var deptC = SeedDept(db, name: "C");
        var sut = CreateSut(db);

        var result = await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-1",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            DepartmentIds = [deptA.Id],
            Products =
            [
                MakeProductDto(productType: "P1", departmentIds: [deptB.Id]),
                MakeProductDto(productType: "P2", departmentIds: [deptC.Id, deptB.Id]),
            ],
        }, Guid.NewGuid());

        result.Succeeded.Should().BeTrue();
        var contract = db.Contracts.Include(c => c.ContractDepartments).Single();
        contract.ContractDepartments.Select(cd => cd.DepartmentId)
            .Should().BeEquivalentTo(new[] { deptA.Id, deptB.Id, deptC.Id });
    }

    [Fact]
    public async Task CreateAsync_NotifiesAssignedUsers_AndSuperAdmins_AndLogsActivity()
    {
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var user = SeedUser(db, dept.Id, login: "u1", isActive: false);
        var creator = Guid.NewGuid();
        var sut = CreateSut(db);

        await sut.Service.CreateAsync(new ContractCreateDto
        {
            ContractNo = "C-N",
            ContractType = ContractType.Mahalliy,
            ContractParty = "X",
            Products =
            [
                MakeProductDto(
                    departmentIds: [dept.Id],
                    users:
                    [
                        new ContractProductUserAssignItem
                        {
                            UserId = user.Id,
                            Role = ContractUserRole.Observer,
                        },
                    ]),
            ],
        }, creator);

        sut.ActivityLog.Verify(a => a.LogAsync(
            "contract",
            It.Is<string>(t => t.Contains("C-N")),
            "X",
            creator,
            It.IsAny<Guid?>()),
            Times.Once);

        sut.Notifications.Verify(n => n.NotifySuperAdminsAsync(
            It.Is<string>(t => t.Contains("C-N")),
            It.IsAny<string>(),
            NotificationType.Info,
            It.IsAny<Guid?>()),
            Times.Once);

        sut.Notifications.Verify(n => n.CreateAsync(
            user.Id,
            It.Is<string>(t => t.Contains("C-N")),
            It.IsAny<string>(),
            NotificationType.Task,
            It.IsAny<Guid?>()),
            Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(Guid.NewGuid(), new ContractUpdateDto
        {
            ContractParty = "Y",
        });

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateAsync_PartialUpdate_OnlyChangesProvidedFields()
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db, contractNo: "C-EDIT");
        var originalParty = contract.ContractParty;
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(contract.Id, new ContractUpdateDto
        {
            Notes = "Yangi izoh",
        });

        result.Succeeded.Should().BeTrue();
        var refreshed = db.Contracts.AsNoTracking().Single(c => c.Id == contract.Id);
        refreshed.Notes.Should().Be("Yangi izoh");
        refreshed.ContractNo.Should().Be("C-EDIT");
        refreshed.ContractParty.Should().Be(originalParty);
    }

    [Fact]
    public async Task UpdateAsync_RenamingToDuplicateActiveContractNo_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var (target, _) = SeedContractWithProduct(db, contractNo: "C-TARGET");
        SeedContractWithProduct(db, contractNo: "C-EXISTING");
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(target.Id, new ContractUpdateDto
        {
            ContractNo = "C-EXISTING",
        });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("allaqachon mavjud");
        db.Contracts.AsNoTracking().Single(c => c.Id == target.Id)
            .ContractNo.Should().Be("C-TARGET", "raqam o'zgarmagan bo'lishi kerak");
    }

    [Fact]
    public async Task UpdateAsync_SameContractNo_DoesNotTriggerDuplicateCheck()
    {
        // ContractNo bir xil yuborilsa — bu o'zgartirish emas, shuning uchun
        // duplicate guard'ga kirmasligi kerak.
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db, contractNo: "C-SAME");
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(contract.Id, new ContractUpdateDto
        {
            ContractNo = "C-SAME",
            Notes = "Update",
        });

        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_WithNewProductList_ReplacesProductsAndAssignsNewIds()
    {
        // Joriy implementatsiya: products to'liq qayta yaratiladi (eskilari o'chiriladi,
        // yangilari yangi Guid bilan kelinadi). Update natijasi yangi ID larni qaytaradi.
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var (contract, oldProduct) = SeedContractWithProduct(db, contractNo: "C-PROD");
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(contract.Id, new ContractUpdateDto
        {
            Products =
            [
                MakeProductDto(productType: "Yangi-1", quantity: 3, departmentIds: [dept.Id]),
                MakeProductDto(productType: "Yangi-2", quantity: 7, departmentIds: [dept.Id]),
            ],
        });

        result.Succeeded.Should().BeTrue();
        result.Result!.Products.Should().HaveCount(2);

        var products = db.ContractProducts.AsNoTracking()
            .Where(p => p.ContractId == contract.Id)
            .OrderBy(p => p.OrderIndex)
            .ToList();
        products.Should().HaveCount(2);
        products.Should().NotContain(p => p.Id == oldProduct.Id,
            "eski mahsulot o'chirilgan bo'lishi kerak");
        products.Select(p => p.ProductType).Should().Equal("Yangi-1", "Yangi-2");
        products.Select(p => p.Quantity).Should().Equal(3, 7);
    }

    [Fact]
    public async Task UpdateAsync_ProductsNull_KeepsExistingProductsUntouched()
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, oldProduct) = SeedContractWithProduct(db);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateAsync(contract.Id, new ContractUpdateDto
        {
            Notes = "Faqat izoh",
        });

        result.Succeeded.Should().BeTrue();
        var products = db.ContractProducts.AsNoTracking()
            .Where(p => p.ContractId == contract.Id)
            .ToList();
        products.Should().ContainSingle()
            .Which.Id.Should().Be(oldProduct.Id, "products null kelganda mavjudlari saqlanadi");
        result.Result!.Products.Single().Id.Should().Be(oldProduct.Id);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  UpdateStatusAsync — status transitions
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatusAsync_NotFound_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateStatusAsync(Guid.NewGuid(), ContractStatus.InProduction);

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Theory]
    [InlineData(ContractStatus.DrawingPending, ContractProductStatus.DrawingPending)]
    [InlineData(ContractStatus.TechProcessing, ContractProductStatus.TechProcessing)]
    [InlineData(ContractStatus.InProduction,   ContractProductStatus.InProduction)]
    [InlineData(ContractStatus.Completed,      ContractProductStatus.Completed)]
    [InlineData(ContractStatus.Cancelled,      ContractProductStatus.Cancelled)]
    public async Task UpdateStatusAsync_PropagatesStatusToActiveProducts(
        ContractStatus contractStatus, ContractProductStatus expectedProductStatus)
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, product) = SeedContractWithProduct(db);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateStatusAsync(contract.Id, contractStatus);

        result.Succeeded.Should().BeTrue();
        db.ContractProducts.AsNoTracking().Single(p => p.Id == product.Id)
            .Status.Should().Be(expectedProductStatus);
    }

    [Fact]
    public async Task UpdateStatusAsync_DoesNotTouchCancelledOrInactiveProducts()
    {
        // Bekor qilingan/passiv mahsulot statusi qayta tirilmaydi — UpdateStatus
        // faqat aktiv va non-cancelled mahsulotlarni o'zgartiradi.
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db);
        var cancelled = new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductType = "Bekor",
            Quantity = 1,
            Unit = "dona",
            OrderIndex = 1,
            Status = ContractProductStatus.Cancelled,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        var inactive = new ContractProduct
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            ProductType = "Nofaol",
            Quantity = 1,
            Unit = "dona",
            OrderIndex = 2,
            Status = ContractProductStatus.DrawingPending,
            IsActive = false,
            CreatedAt = DateTime.UtcNow,
        };
        db.ContractProducts.AddRange(cancelled, inactive);
        db.SaveChanges();
        var sut = CreateSut(db);

        await sut.Service.UpdateStatusAsync(contract.Id, ContractStatus.InProduction);

        db.ContractProducts.AsNoTracking().Single(p => p.Id == cancelled.Id)
            .Status.Should().Be(ContractProductStatus.Cancelled);
        db.ContractProducts.AsNoTracking().Single(p => p.Id == inactive.Id)
            .Status.Should().Be(ContractProductStatus.DrawingPending);
    }

    [Fact]
    public async Task UpdateStatusAsync_DoesNotNotify_WhenStatusIsDrawingPending()
    {
        // DrawingPending — yaratilish payti default'i, foydalanuvchini bezovta qilmaslik
        // uchun shu o'tishda bildirishnoma yuborilmaydi.
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db, status: ContractStatus.TechProcessing,
            productStatus: ContractProductStatus.TechProcessing);
        var sut = CreateSut(db);

        await sut.Service.UpdateStatusAsync(contract.Id, ContractStatus.DrawingPending);

        sut.Notifications.Verify(n => n.NotifyUsersAndSuperAdminsAsync(
            It.IsAny<IEnumerable<Guid>>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<NotificationType>(),
            It.IsAny<Guid?>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateStatusAsync_NotifiesUsers_AndSyncsManufactured_OnInProduction()
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db);
        var sut = CreateSut(db);

        await sut.Service.UpdateStatusAsync(contract.Id, ContractStatus.InProduction);

        sut.Notifications.Verify(n => n.NotifyUsersAndSuperAdminsAsync(
            It.IsAny<IEnumerable<Guid>>(),
            It.Is<string>(t => t.Contains(contract.ContractNo)),
            It.IsAny<string>(),
            NotificationType.Info,
            contract.Id),
            Times.Once);
        sut.Manufactured.Verify(m => m.SyncForContractAsync(contract.Id), Times.Once);
    }

    [Fact]
    public async Task UpdateStatusAsync_CannotRegressAdvancedProductToEarlierStage()
    {
        // Monotonic transition guard: ilgarilab ketgan mahsulotni (Completed) qo'lda
        // orqaga (DrawingPending) qaytarib bo'lmaydi — aks holda ishlab chiqarilgan
        // mahsulot kuzatuvi yo'qolardi. Mahsulot Completed bo'lib qoladi va
        // RecomputeContractStatusAsync aggregatni yana Completed ga tiklaydi.
        await using var db = TestDbContextFactory.Create();
        var (contract, product) = SeedContractWithProduct(db,
            status: ContractStatus.Completed,
            productStatus: ContractProductStatus.Completed);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateStatusAsync(contract.Id, ContractStatus.DrawingPending);

        result.Succeeded.Should().BeTrue();
        db.ContractProducts.AsNoTracking().Single(p => p.Id == product.Id)
            .Status.Should().Be(ContractProductStatus.Completed, "regressiya bloklanadi");

        // Aggregat product holatidan qayta hisoblanadi — yagona product Completed,
        // shuning uchun shartnoma ham Completed bo'lib qoladi.
        var savedContract = db.Contracts.AsNoTracking().Single(c => c.Id == contract.Id);
        savedContract.Status.Should().Be(ContractStatus.Completed);
    }

    [Fact]
    public async Task UpdateStatusAsync_AdvancesProductForward_WhenStatusMovesUp()
    {
        // Oldinga siljish (DrawingPending → InProduction) odatdagidek tarqaladi.
        await using var db = TestDbContextFactory.Create();
        var (contract, product) = SeedContractWithProduct(db,
            status: ContractStatus.DrawingPending,
            productStatus: ContractProductStatus.DrawingPending);
        var sut = CreateSut(db);

        var result = await sut.Service.UpdateStatusAsync(contract.Id, ContractStatus.InProduction);

        result.Succeeded.Should().BeTrue();
        db.ContractProducts.AsNoTracking().Single(p => p.Id == product.Id)
            .Status.Should().Be(ContractProductStatus.InProduction);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  ActivateAsync — transition guards
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ActivateAsync_CompletedContract_ReturnsFailure()
    {
        // Yakunlangan shartnomani qayta tiriltirib bo'lmaydi — bu yagona qattiq
        // monotonic guard. UpdateStatusAsync bunaqa cheklov qo'ymaydi, lekin
        // arxivdan chiqarish (ActivateAsync) Completed ni alohida tekshiradi.
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db,
            status: ContractStatus.Completed,
            isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.ActivateAsync(contract.Id);

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(400);
        result.Errors.Should().ContainSingle().Which.Should().Contain("Yakunlangan");
        db.Contracts.AsNoTracking().Single(c => c.Id == contract.Id)
            .IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task ActivateAsync_AnotherActiveContractWithSameNo_Returns409()
    {
        await using var db = TestDbContextFactory.Create();
        var (oldContract, _) = SeedContractWithProduct(db, contractNo: "C-X", isActive: false);
        SeedContractWithProduct(db, contractNo: "C-X");  // active duplicate
        var sut = CreateSut(db);

        var result = await sut.Service.ActivateAsync(oldContract.Id);

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(409);
        result.Errors.Should().ContainSingle().Which.Should().Contain("allaqachon mavjud");
    }

    [Fact]
    public async Task ActivateAsync_ResolvesProductStageFromState_AndSyncsManufactured()
    {
        // Arxivlanganda Cancelled bo'lib qolgan mahsulot — qayta faollashtirilganda
        // hozirgi TP/CN/drawing holatiga qarab qayta hisoblansin. Hech qanday TP
        // yoki tasdiqlangan chizma yo'q → DrawingPending ga qaytadi.
        await using var db = TestDbContextFactory.Create();
        var (contract, product) = SeedContractWithProduct(db,
            status: ContractStatus.Cancelled,
            productStatus: ContractProductStatus.Cancelled,
            isActive: false);
        var sut = CreateSut(db);

        var result = await sut.Service.ActivateAsync(contract.Id);

        result.Succeeded.Should().BeTrue();
        var refreshed = db.Contracts.AsNoTracking().Single(c => c.Id == contract.Id);
        refreshed.IsActive.Should().BeTrue();
        refreshed.DeactivationReason.Should().BeNull();
        refreshed.DeactivatedAt.Should().BeNull();
        db.ContractProducts.AsNoTracking().Single(p => p.Id == product.Id)
            .Status.Should().Be(ContractProductStatus.DrawingPending);
        sut.Manufactured.Verify(m => m.SyncForContractAsync(contract.Id), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DeactivateAsync — soft-delete cascade
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeactivateAsync_InvalidReason_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.DeactivateAsync(Guid.NewGuid(),
            new ContractDeactivateDto { Reason = (ContractDeactivationReason)999 });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("Noto'g'ri sabab");
    }

    [Fact]
    public async Task DeactivateAsync_ReasonOther_WithoutNote_ReturnsFailure()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.DeactivateAsync(Guid.NewGuid(),
            new ContractDeactivateDto
            {
                Reason = ContractDeactivationReason.Other,
                Note = "  ",
            });

        result.Succeeded.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("sababni qo'lda yozib");
    }

    [Fact]
    public async Task DeactivateAsync_NotFound_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.DeactivateAsync(Guid.NewGuid(),
            new ContractDeactivateDto
            {
                Reason = ContractDeactivationReason.CustomerCancelled,
            });

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeactivateAsync_CascadesIsActiveFalse_AcrossRelatedEntities()
    {
        // Soft-delete: shartnomaga ulangan barcha child entity larni (products,
        // tech jarayonlar, chizmalar, xarajat normalari, vazifa loglari) nofaol
        // qiladi. Products statusi Cancelled ga o'tadi.
        await using var db = TestDbContextFactory.Create();
        var dept = SeedDept(db);
        var (contract, product) = SeedContractWithProduct(db);

        var contractUser = new ContractUser
        {
            ContractId = contract.Id,
            UserId = Guid.NewGuid(),
            Role = ContractUserRole.Responsible,
            IsActive = true,
        };
        var contractDept = new ContractDepartment
        {
            ContractId = contract.Id,
            DepartmentId = dept.Id,
            IsActive = true,
        };
        var tp = new TechProcess
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Title = "TP-1",
            IsActive = true,
        };
        var drawing = new TechnicalDrawing
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Title = "TD-1",
            IsActive = true,
            CreatedBy = Guid.NewGuid(),
        };
        var cn = new CostNorm
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Title = "CN-1",
            IsActive = true,
            CreatedBy = Guid.NewGuid(),
        };
        var cnItem = new CostNormItem
        {
            Id = Guid.NewGuid(),
            CostNormId = cn.Id,
            IsActive = true,
        };
        var task = new ContractTask
        {
            Id = Guid.NewGuid(),
            ContractId = contract.Id,
            Name = "Vazifa-1",
            IsActive = true,
            CreatedBy = Guid.NewGuid(),
        };
        var log = new ContractTaskDailyLog
        {
            Id = Guid.NewGuid(),
            TaskId = task.Id,
            Amount = 5,
            Date = DateOnly.FromDateTime(DateTime.UtcNow),
            IsActive = true,
            CreatedBy = Guid.NewGuid(),
        };
        db.ContractUsers.Add(contractUser);
        db.ContractDepartments.Add(contractDept);
        db.TechProcesses.Add(tp);
        db.TechnicalDrawings.Add(drawing);
        db.CostNorms.Add(cn);
        db.CostNormItems.Add(cnItem);
        db.ContractTasks.Add(task);
        db.ContractTaskDailyLogs.Add(log);
        db.SaveChanges();

        var sut = CreateSut(db);

        var result = await sut.Service.DeactivateAsync(contract.Id, new ContractDeactivateDto
        {
            Reason = ContractDeactivationReason.CustomerCancelled,
        });

        result.Succeeded.Should().BeTrue();
        var refreshed = db.Contracts.AsNoTracking().Single(c => c.Id == contract.Id);
        refreshed.IsActive.Should().BeFalse();
        refreshed.DeactivationReason.Should().Be(ContractDeactivationReason.CustomerCancelled);
        refreshed.DeactivatedAt.Should().NotBeNull();

        db.ContractProducts.AsNoTracking().Single(p => p.Id == product.Id)
            .Should().Match<ContractProduct>(p => !p.IsActive && p.Status == ContractProductStatus.Cancelled);
        db.ContractUsers.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.ContractDepartments.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.TechProcesses.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.TechnicalDrawings.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.CostNorms.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.CostNormItems.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.ContractTasks.AsNoTracking().Single().IsActive.Should().BeFalse();
        db.ContractTaskDailyLogs.AsNoTracking().Single().IsActive.Should().BeFalse();

        sut.Manufactured.Verify(m => m.SyncForContractAsync(contract.Id), Times.Once);
    }

    [Fact]
    public async Task DeactivateAsync_DoesNotDeleteRequisitionRows()
    {
        // Talabnoma (Requisition) larni hozirgi servis qayta cheklamaydi — soft-delete
        // cascade'i ularga tegmaydi. Aktiv talabnomalar shartnoma arxivga ko'chgandan
        // keyin ham mavjud bo'lib qoladi.
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db);
        var req = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = "REQ-1",
            Type = RequisitionType.Contract,
            Status = RequisitionStatus.PendingWarehouseCheck,
            ContractId = contract.Id,
            CreatedBy = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
        };
        db.Requisitions.Add(req);
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.DeactivateAsync(contract.Id, new ContractDeactivateDto
        {
            Reason = ContractDeactivationReason.CustomerCancelled,
        });

        result.Succeeded.Should().BeTrue();
        var refreshedReq = db.Requisitions.AsNoTracking().Single();
        refreshedReq.Status.Should().Be(RequisitionStatus.PendingWarehouseCheck,
            "shartnoma deaktivatsiyasi talabnoma statusiga ta'sir qilmaydi");
    }

    // ─────────────────────────────────────────────────────────────────────
    //  AssignUsersAsync / RemoveUserAsync — light coverage
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AssignUsersAsync_AddsNewUsers_AndUpdatesExistingRole()
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db);
        var existingUserId = Guid.NewGuid();
        var newUserId = Guid.NewGuid();
        db.ContractUsers.Add(new ContractUser
        {
            ContractId = contract.Id,
            UserId = existingUserId,
            Role = ContractUserRole.Responsible,
        });
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.AssignUsersAsync(contract.Id,
        [
            new ContractUserAssignItem { UserId = existingUserId, Role = ContractUserRole.Observer },
            new ContractUserAssignItem { UserId = newUserId,     Role = ContractUserRole.Supervisor },
        ]);

        result.Succeeded.Should().BeTrue();
        db.ContractUsers.AsNoTracking().Should().HaveCount(2);
        db.ContractUsers.AsNoTracking().Single(cu => cu.UserId == existingUserId)
            .Role.Should().Be(ContractUserRole.Observer, "rol yangilanishi kerak");
        db.ContractUsers.AsNoTracking().Single(cu => cu.UserId == newUserId)
            .Role.Should().Be(ContractUserRole.Supervisor);

        sut.Notifications.Verify(n => n.CreateAsync(
            newUserId, It.IsAny<string>(), It.IsAny<string>(),
            NotificationType.Task, contract.Id),
            Times.Once);
        sut.Notifications.Verify(n => n.CreateAsync(
            existingUserId, It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<NotificationType>(), It.IsAny<Guid?>()),
            Times.Never);
    }

    [Fact]
    public async Task AssignUsersAsync_ContractNotFound_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.AssignUsersAsync(Guid.NewGuid(),
        [
            new ContractUserAssignItem { UserId = Guid.NewGuid(), Role = ContractUserRole.Responsible },
        ]);

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RemoveUserAsync_OnAssignedUser_DeletesRow()
    {
        await using var db = TestDbContextFactory.Create();
        var (contract, _) = SeedContractWithProduct(db);
        var userId = Guid.NewGuid();
        db.ContractUsers.Add(new ContractUser
        {
            ContractId = contract.Id,
            UserId = userId,
            Role = ContractUserRole.Responsible,
        });
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.RemoveUserAsync(contract.Id, userId);

        result.Succeeded.Should().BeTrue();
        db.ContractUsers.AsNoTracking().Should().BeEmpty();
    }

    [Fact]
    public async Task RemoveUserAsync_NonExistentAssignment_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.RemoveUserAsync(Guid.NewGuid(), Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GetByIdAsync
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_NotFound_Returns404()
    {
        await using var db = TestDbContextFactory.Create();
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(Guid.NewGuid());

        result.Succeeded.Should().BeFalse();
        result.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsMappedDtoWithProducts()
    {
        // GetByIdAsync uses a deep Include chain that requires the Creator User row
        // to exist — otherwise EF InMemory's left-join behavior here yields no contract.
        await using var db = TestDbContextFactory.Create();
        var creator = SeedUser(db, SeedDept(db).Id, login: "creator");
        var (contract, product) = SeedContractWithProduct(db, contractNo: "C-MAP");
        contract.CreatedBy = creator.Id;
        db.SaveChanges();
        var sut = CreateSut(db);

        var result = await sut.Service.GetByIdAsync(contract.Id);

        result.Succeeded.Should().BeTrue(string.Join(" | ", result.Errors));
        var dto = result.Result!;
        dto.ContractNo.Should().Be("C-MAP");
        dto.Products.Should().ContainSingle()
            .Which.Id.Should().Be(product.Id);
    }
}
