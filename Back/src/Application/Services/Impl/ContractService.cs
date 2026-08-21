using System.Linq.Expressions;
using Application.DTOs;
using Application.DTOs.Contracts;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class ContractService : IContractService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IManufacturedProductService _manufacturedProductService;
    private readonly IActivityLogService _activityLogService;

    public ContractService(
        DatabaseContext context,
        INotificationService notificationService,
        IManufacturedProductService manufacturedProductService,
        IActivityLogService activityLogService)
    {
        _context = context;
        _notificationService = notificationService;
        _manufacturedProductService = manufacturedProductService;
        _activityLogService = activityLogService;
    }

    // Ko'rinish filtri uchun foydalanuvchining bo'limi — har bir so'rovda
    // bir marta olinadi va so'rov ichida parametr sifatida ishlatiladi.
    private Task<Guid?> GetUserDepartmentIdAsync(Guid userId) =>
        _context.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.DepartmentId)
            .FirstOrDefaultAsync();

    // Lookup ro'yxati (`GET /api/contract`) — shartnoma/mahsulot tanlash uchun
    // dropdownlarda ishlatiladi. Entity Include qilinmaydi: so'rov to'g'ridan-to'g'ri
    // yengil DTO'ga proyeksiya qilinadi, shuning uchun yaratuvchi, biriktirilgan
    // xodimlar va katalog kabi ortiqcha joinlar umuman bajarilmaydi.
    public async Task<ApiResult<IEnumerable<ContractSummaryDto>>> GetAllAsync(Guid currentUserId, bool viewAll, bool? isActive = null)
    {
        Guid? userDeptId = viewAll ? null : await GetUserDepartmentIdAsync(currentUserId);

        var query = _context.Contracts.AsNoTracking();

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId)));
        }

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ContractSummaryDto
            {
                Id            = c.Id,
                ContractNo    = c.ContractNo,
                ContractParty = c.ContractParty,
                StartDate     = c.StartDate,
                EndDate       = c.EndDate,
                ContractType  = c.ContractType,
                Status        = c.Status,
                IsActive      = c.IsActive,
                Departments   = c.ContractDepartments
                    .Where(cd => cd.Department != null)
                    .Select(cd => new ContractDepartmentDto
                    {
                        Id   = cd.Department!.Id,
                        Name = cd.Department.Name,
                        Type = cd.Department.Type,
                    }).ToList(),
                Products = c.Products
                    .Where(p => viewAll
                        || c.ContractUsers.Any(cu => cu.UserId == currentUserId)
                        || c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId)
                        || p.ProductUsers.Any(pu => pu.UserId == currentUserId)
                        || p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId))
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => new ContractSummaryProductDto
                    {
                        Id          = p.Id,
                        ProductType = p.ProductType,
                        Quantity    = p.Quantity,
                        Unit        = p.Unit,
                        Status      = p.Status,
                        Notes       = p.Notes,
                        Departments = p.ProductDepartments
                            .Where(pd => pd.Department != null)
                            .Select(pd => new ContractDepartmentDto
                            {
                                Id   = pd.Department!.Id,
                                Name = pd.Department.Name,
                                Type = pd.Department.Type,
                            }).ToList(),
                    }).ToList(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractSummaryDto>>.Success(contracts);
    }

    public async Task<ApiResult<PagedResult<ContractSummaryDto>>> GetPagedAsync(
        Guid currentUserId,
        bool viewAll,
        PaginationParams pagination,
        string? search = null,
        ContractStatus? status = null,
        ContractType? contractType = null,
        bool? isActive = null,
        bool excludeCompleted = false,
        string? sortBy = null,
        bool sortDesc = false)
    {
        Guid? userDeptId = viewAll ? null : await GetUserDepartmentIdAsync(currentUserId);

        var query = _context.Contracts.AsNoTracking();

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId)));
        }

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        // "Faol" ro'yxati uchun: yakunlanganlar arxivning "Yakunlangan" bo'limida
        // ko'rsatiladi, shu sababli bu yerdan chiqarib tashlanadi.
        if (excludeCompleted)
            query = query.Where(c => c.Status != ContractStatus.Completed);

        if (contractType.HasValue)
            query = query.Where(c => c.ContractType == contractType.Value);

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.ToLower();
            query = query.Where(c =>
                c.ContractNo.ToLower().Contains(lower) ||
                c.ContractParty.ToLower().Contains(lower));
        }

        var totalCount = await query.CountAsync();

        // Holat ustuni badge'da ko'rinadigan progress foizi bo'yicha saralanadi —
        // og'irliklar frontend StatusBadge bilan bir xil: chizma 0, tex jarayon 10,
        // ishlab chiqarish 50, yakunlangan 100; bekor qilingan mahsulotlar hisobga
        // olinmaydi, mahsulotsiz shartnoma 0% deb qaraladi.
        Expression<Func<Contract, double>> progressPercent = c =>
            c.Products
                .Where(p => p.IsActive && p.Status != ContractProductStatus.Cancelled)
                .Average(p => (double?)(
                    p.Status == ContractProductStatus.Completed    ? 100.0 :
                    p.Status == ContractProductStatus.InProduction ? 50.0  :
                    p.Status == ContractProductStatus.TechProcessing ? 10.0 : 0.0)) ?? 0.0;

        // Ustun sarlavhasi bo'yicha saralash; berilmasa — eng yangi shartnomalar birinchi.
        IOrderedQueryable<Contract> ordered = (sortBy?.ToLowerInvariant(), sortDesc) switch
        {
            ("contractno", false)   => query.OrderBy(c => c.ContractNo),
            ("contractno", true)    => query.OrderByDescending(c => c.ContractNo),
            ("startdate", false)    => query.OrderBy(c => c.StartDate),
            ("startdate", true)     => query.OrderByDescending(c => c.StartDate),
            ("enddate", false)      => query.OrderBy(c => c.EndDate),
            ("enddate", true)       => query.OrderByDescending(c => c.EndDate),
            ("contracttype", false) => query.OrderBy(c => c.ContractType),
            ("contracttype", true)  => query.OrderByDescending(c => c.ContractType),
            ("status", false)       => query.OrderBy(progressPercent),
            ("status", true)        => query.OrderByDescending(progressPercent),
            _                       => query.OrderByDescending(c => c.CreatedAt),
        };

        // Ro'yxat jadvali uchun kerakli maydonlargina tanlanadi. Mijozga topshirish
        // hisobi (umumiy/jo'natilgan miqdor) shu bitta so'rov ichida korrelyatsion
        // subquery sifatida hisoblanadi — oldingi qo'shimcha ikkita GROUP BY so'rovi
        // va butun entity grafini yuklash olib tashlandi.
        var items = await ordered
            // Skip/Take uchun barqaror tartib shart — saralash ustuni unikal
            // bo'lmasligi mumkin, shuning uchun Id bilan ham tartiblaymiz.
            .ThenBy(c => c.Id)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(c => new ContractSummaryDto
            {
                Id            = c.Id,
                ContractNo    = c.ContractNo,
                ContractParty = c.ContractParty,
                StartDate     = c.StartDate,
                EndDate       = c.EndDate,
                ContractType  = c.ContractType,
                Status        = c.Status,
                IsActive      = c.IsActive,
                // Umumiy miqdor barcha faol mahsulotlardan olinadi (ko'rinish
                // filtridan mustaqil) — arxiv "Yakunlangan" badge'i uchun.
                TotalQuantity = c.Products
                    .Where(p => p.IsActive && p.Status != ContractProductStatus.Cancelled)
                    .Sum(p => (decimal?)p.Quantity) ?? 0,
                // Faqat mijoz olib ketgan partiyalar — ishlab chiqarishning ichki
                // partiyalari (Production) mijozga topshirilgan hisoblanmaydi.
                ShippedQuantity = _context.ShipmentBatches
                    .Where(s => s.ContractId == c.Id && s.Kind == ShipmentBatchKind.CustomerPickup)
                    .Sum(s => (decimal?)s.Amount) ?? 0,
                Products = c.Products
                    .Where(p => viewAll
                        || c.ContractUsers.Any(cu => cu.UserId == currentUserId)
                        || c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId)
                        || p.ProductUsers.Any(pu => pu.UserId == currentUserId)
                        || p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId))
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => new ContractSummaryProductDto
                    {
                        Id          = p.Id,
                        ProductType = p.ProductType,
                        Quantity    = p.Quantity,
                        Unit        = p.Unit,
                        Status      = p.Status,
                    }).ToList(),
            })
            .ToListAsync();

        var paged = PagedResult<ContractSummaryDto>.Create(items, totalCount, pagination);
        return ApiResult<PagedResult<ContractSummaryDto>>.Success(paged);
    }

    // Mijoz hali to'liq olib ketmagan yakunlangan shartnomalar soni — arxiv
    // tabidagi eslatma indikatori uchun. Faol mahsulotlar miqdori yig'indisi
    // jo'natilgan partiyalar yig'indisidan katta bo'lsa — qoldiq bor.
    public async Task<ApiResult<int>> GetPendingPickupCountAsync(Guid currentUserId, bool viewAll)
    {
        Guid? userDeptId = viewAll ? null : await GetUserDepartmentIdAsync(currentUserId);

        var query = _context.Contracts
            .AsNoTracking()
            .Where(c => c.IsActive && c.Status == ContractStatus.Completed);

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId)));
        }

        var count = await query.CountAsync(c =>
            (c.Products
                .Where(p => p.IsActive && p.Status != ContractProductStatus.Cancelled)
                .Sum(p => (decimal?)p.Quantity) ?? 0)
            >
            (_context.ShipmentBatches
                .Where(s => s.ContractId == c.Id
                            && s.Kind == ShipmentBatchKind.CustomerPickup)
                .Sum(s => (decimal?)s.Amount) ?? 0));

        return ApiResult<int>.Success(count);
    }

    // Mahsulot tanlash dropdowni uchun — nomi va miqdoridan boshqa hech narsa kerak emas.
    public async Task<ApiResult<IEnumerable<ContractSummaryProductDto>>> GetProductsLookupAsync(Guid contractId)
    {
        var products = await _context.ContractProducts
            .AsNoTracking()
            .Where(p => p.ContractId == contractId)
            .OrderBy(p => p.OrderIndex)
            .Select(p => new ContractSummaryProductDto
            {
                Id          = p.Id,
                ProductType = p.ProductType,
                Quantity    = p.Quantity,
                Unit        = p.Unit,
                Status      = p.Status,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractSummaryProductDto>>.Success(products);
    }

    public async Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .Include(c => c.ContractUsers).ThenInclude(cu => cu.User).ThenInclude(u => u!.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductCatalog)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments).ThenInclude(pd => pd.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers).ThenInclude(pu => pu.User).ThenInclude(u => u!.Department)
            .AsNoTracking()
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<ContractResponseDto>.Failure([$"Contract with id '{id}' not found."], 404);

        return ApiResult<ContractResponseDto>.Success(MapToResponse(contract));
    }

    public async Task<ApiResult<ContractCreateResultDto>> CreateAsync(ContractCreateDto dto, Guid createdBy)
    {
        if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo && c.IsActive))
            return ApiResult<ContractCreateResultDto>.Failure([$"«{dto.ContractNo}» raqamli aktiv shartnoma allaqachon mavjud."]);

        var validationErrors = await ValidateProductsAsync(dto.Products);
        if (validationErrors.Count > 0)
            return ApiResult<ContractCreateResultDto>.Failure(validationErrors, 400);

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = dto.ContractNo,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            ContractType = dto.ContractType,
            ContractParty = dto.ContractParty,
            Status = ContractStatus.DrawingPending,
            Notes = dto.Notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Contracts.Add(contract);

        // Contract-level departments stay supported for legacy callers; if
        // a product carries its own departments, the contract row mirrors the union
        // so existing visibility rules keep working.
        var contractDeptIds = dto.DepartmentIds
            .Concat(dto.Products.SelectMany(p => p.DepartmentIds))
            .Distinct()
            .ToList();
        foreach (var deptId in contractDeptIds)
        {
            _context.ContractDepartments.Add(new ContractDepartment
            {
                ContractId = contract.Id,
                DepartmentId = deptId,
            });
        }

        var assignedUserIds = new HashSet<Guid>();
        var productResults = new List<ContractProductIdResultDto>();
        var orderIdx = 0;
        foreach (var p in dto.Products)
        {
            if (string.IsNullOrWhiteSpace(p.ProductType)) continue;

            var productId = Guid.NewGuid();
            var thisOrderIdx = orderIdx++;
            _context.ContractProducts.Add(new ContractProduct
            {
                Id = productId,
                ContractId = contract.Id,
                ProductCatalogId = p.ProductCatalogId,
                ProductType = p.ProductType.Trim(),
                Quantity = p.Quantity,
                Unit = p.Unit ?? string.Empty,
                Notes = p.Notes,
                OrderIndex = thisOrderIdx,
                CreatedAt = DateTime.UtcNow,
            });
            productResults.Add(new ContractProductIdResultDto { Id = productId, OrderIndex = thisOrderIdx });

            foreach (var dId in p.DepartmentIds.Distinct())
            {
                _context.ContractProductDepartments.Add(new ContractProductDepartment
                {
                    ContractProductId = productId,
                    DepartmentId = dId,
                });
            }

            foreach (var u in p.Users.DistinctBy(x => new { x.UserId, x.Role }))
            {
                _context.ContractProductUsers.Add(new ContractProductUser
                {
                    ContractProductId = productId,
                    UserId = u.UserId,
                    Role = u.Role,
                });
                assignedUserIds.Add(u.UserId);
            }
        }

        await _context.SaveChangesAsync();

        await _activityLogService.LogAsync(
            kind: "contract",
            title: $"Yangi shartnoma: {contract.ContractNo}",
            subtitle: contract.ContractParty,
            actorId: createdBy,
            refId: contract.Id);

        await _notificationService.NotifySuperAdminsAsync(
            $"Yangi shartnoma yaratildi: {contract.ContractNo}",
            $"«{contract.ContractNo}» raqamli yangi shartnoma tizimga qo'shildi.",
            NotificationType.Info,
            contract.Id);

        foreach (var uid in assignedUserIds)
        {
            await _notificationService.CreateAsync(
                uid,
                $"Shartnomaga tayinlandingiz: {contract.ContractNo}",
                $"Sizga «{contract.ContractNo}» shartnomasi bo'yicha vazifa berildi.",
                NotificationType.Task,
                contract.Id);
        }

        var createResult = new ContractCreateResultDto
        {
            Id = contract.Id,
            Products = productResults,
        };
        return ApiResult<ContractCreateResultDto>.Success(createResult, 201);
    }

    private async Task<List<string>> ValidateProductsAsync(IEnumerable<ContractProductCreateDto> products)
    {
        var errors = new List<string>();

        // Bo'sh shartnomalarga yo'l qo'ymaymiz — kamida bitta to'g'ri mahsulot bo'lishi shart.
        // Aks holda ProductType bo'sh qatorlar quyida tashlab yuborilib, hech bir mahsulotsiz
        // (orphan) shartnoma yaratilib qolardi.
        if (!products.Any(p => !string.IsNullOrWhiteSpace(p.ProductType)))
        {
            errors.Add("Shartnomada kamida bitta to'g'ri mahsulot bo'lishi shart.");
            return errors;
        }

        var idx = 0;
        foreach (var p in products)
        {
            idx++;
            if (string.IsNullOrWhiteSpace(p.ProductType)) continue;
            if (p.Quantity <= 0)
                errors.Add($"Mahsulot #{idx}: miqdorni kiriting (0 dan katta son).");
            if (string.IsNullOrWhiteSpace(p.Unit))
                errors.Add($"Mahsulot #{idx}: o'lchov birligini tanlang.");
        }

        var catalogIds = products
            .Where(p => p.ProductCatalogId.HasValue)
            .Select(p => p.ProductCatalogId!.Value)
            .Distinct()
            .ToList();
        if (catalogIds.Count > 0)
        {
            var existingCatalog = await _context.ProductCatalogs
                .Where(pc => catalogIds.Contains(pc.Id))
                .Select(pc => pc.Id)
                .ToListAsync();
            foreach (var missing in catalogIds.Except(existingCatalog))
                errors.Add($"Katalog mahsuloti topilmadi: {missing}");
        }

        var deptIds = products.SelectMany(p => p.DepartmentIds).Distinct().ToList();
        var userIds = products.SelectMany(p => p.Users.Select(u => u.UserId)).Distinct().ToList();

        if (deptIds.Count > 0)
        {
            var existingDepts = await _context.Departments
                .Where(d => deptIds.Contains(d.Id))
                .Select(d => d.Id)
                .ToListAsync();
            foreach (var missing in deptIds.Except(existingDepts))
                errors.Add($"Bo'lim topilmadi: {missing}");
        }

        if (userIds.Count > 0)
        {
            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.DepartmentId })
                .ToListAsync();
            var existingUserIds = users.Select(u => u.Id).ToHashSet();
            foreach (var missing in userIds.Except(existingUserIds))
                errors.Add($"Foydalanuvchi topilmadi: {missing}");

            // Each Responsible/Supervisor user must belong to one of the product's selected departments.
            // Observers (Boshqaruv) skip this check.
            foreach (var p in products)
            {
                if (p.DepartmentIds.Count == 0) continue;
                foreach (var u in p.Users)
                {
                    if (u.Role == ContractUserRole.Observer) continue;
                    var ud = users.FirstOrDefault(x => x.Id == u.UserId);
                    if (ud is null) continue;
                    if (ud.DepartmentId is null || !p.DepartmentIds.Contains(ud.DepartmentId.Value))
                        errors.Add($"Xodim {u.UserId} mahsulot tanlangan bo'limlardan emas.");
                }
            }
        }

        return errors;
    }

    public async Task<ApiResult<ContractCreateResultDto>> UpdateAsync(Guid id, ContractUpdateDto dto)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments)
            .Include(c => c.ContractUsers)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<ContractCreateResultDto>.Failure([$"Contract with id '{id}' not found."], 404);

        // Yakunlangan shartnoma tarixiy hujjat — uni tahrirlash taqiqlanadi.
        if (contract.Status == ContractStatus.Completed)
            return ApiResult<ContractCreateResultDto>.Failure(
                ["Yakunlangan shartnomani tahrirlab bo'lmaydi."], 400);

        if (dto.ContractNo is not null && dto.ContractNo != contract.ContractNo)
        {
            if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo && c.IsActive && c.Id != contract.Id))
                return ApiResult<ContractCreateResultDto>.Failure([$"«{dto.ContractNo}» raqamli aktiv shartnoma allaqachon mavjud."]);

            contract.ContractNo = dto.ContractNo;
        }

        if (dto.StartDate.HasValue) contract.StartDate = dto.StartDate.Value;
        if (dto.EndDate.HasValue) contract.EndDate = dto.EndDate.Value;
        if (dto.ContractType.HasValue) contract.ContractType = dto.ContractType.Value;
        if (dto.ContractParty is not null) contract.ContractParty = dto.ContractParty;
        if (dto.Notes is not null) contract.Notes = dto.Notes;

        if (dto.Products is not null)
        {
            var validationErrors = await ValidateProductsAsync(dto.Products);
            if (validationErrors.Count > 0)
                return ApiResult<ContractCreateResultDto>.Failure(validationErrors, 400);
        }

        if (dto.DepartmentIds is not null || dto.Products is not null)
        {
            // Mirror per-product departments into contract-level for legacy visibility.
            var contractDeptIds = (dto.DepartmentIds ?? new List<Guid>())
                .Concat(dto.Products?.SelectMany(p => p.DepartmentIds) ?? Enumerable.Empty<Guid>())
                .Distinct()
                .ToList();

            _context.ContractDepartments.RemoveRange(contract.ContractDepartments);
            foreach (var deptId in contractDeptIds)
            {
                _context.ContractDepartments.Add(new ContractDepartment
                {
                    ContractId = contract.Id,
                    DepartmentId = deptId,
                });
            }
        }

        var productResults = new List<ContractProductIdResultDto>();
        if (dto.Products is not null)
        {
            // Remove all existing product rows + their FK rows (cascade handles m2m).
            _context.ContractProducts.RemoveRange(contract.Products);
            var orderIdx = 0;
            foreach (var p in dto.Products)
            {
                if (string.IsNullOrWhiteSpace(p.ProductType)) continue;
                var productId = Guid.NewGuid();
                var thisOrderIdx = orderIdx++;
                _context.ContractProducts.Add(new ContractProduct
                {
                    Id = productId,
                    ContractId = contract.Id,
                    ProductCatalogId = p.ProductCatalogId,
                    ProductType = p.ProductType.Trim(),
                    Quantity = p.Quantity,
                    Unit = p.Unit ?? string.Empty,
                    Notes = p.Notes,
                    OrderIndex = thisOrderIdx,
                    CreatedAt = DateTime.UtcNow,
                });
                productResults.Add(new ContractProductIdResultDto { Id = productId, OrderIndex = thisOrderIdx });

                foreach (var dId in p.DepartmentIds.Distinct())
                {
                    _context.ContractProductDepartments.Add(new ContractProductDepartment
                    {
                        ContractProductId = productId,
                        DepartmentId = dId,
                    });
                }

                foreach (var u in p.Users.DistinctBy(x => new { x.UserId, x.Role }))
                {
                    _context.ContractProductUsers.Add(new ContractProductUser
                    {
                        ContractProductId = productId,
                        UserId = u.UserId,
                        Role = u.Role,
                    });
                }
            }
        }
        else
        {
            // No product changes — return existing IDs unchanged.
            productResults = contract.Products
                .OrderBy(p => p.OrderIndex)
                .Select(p => new ContractProductIdResultDto { Id = p.Id, OrderIndex = p.OrderIndex })
                .ToList();
        }

        await _context.SaveChangesAsync();

        var title = $"Shartnoma yangilandi: {contract.ContractNo}";
        var body  = $"№{contract.ContractNo} shartnoma ma'lumotlari yangilandi.";

        var userIds = contract.ContractUsers.Select(cu => cu.UserId).ToHashSet();
        var deptUserIds = await _context.Users
            .Where(u => u.IsActive && contract.ContractDepartments.Select(cd => cd.DepartmentId).Contains(u.DepartmentId!.Value))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            userIds.Union(deptUserIds), title, body, NotificationType.Info, contract.Id);

        return ApiResult<ContractCreateResultDto>.Success(new ContractCreateResultDto
        {
            Id = contract.Id,
            Products = productResults,
        });
    }

    // Re-derives a product's stage from its current TP/CN/drawing state. Used
    // when reactivating a contract — frozen Cancelled status would otherwise
    // hide the product from /manufactured even after its work resumes.
    private async Task<ContractProductStatus> ResolveProductStageAsync(Guid productId)
    {
        if (await ContractStatusHelper.IsProductReadyForProductionAsync(_context, productId))
            return ContractProductStatus.InProduction;

        var hasTpOrApprovedDrawing = await _context.TechProcesses.AnyAsync(t => t.ContractProductId == productId)
            || await _context.TechnicalDrawings
                .AnyAsync(d => d.ContractProductId == productId && d.Status == DrawingStatus.Approved);

        return hasTpOrApprovedDrawing
            ? ContractProductStatus.TechProcessing
            : ContractProductStatus.DrawingPending;
    }

    public async Task<ApiResult<int>> DeactivateAsync(Guid id, ContractDeactivateDto dto)
    {
        if (!Enum.IsDefined(typeof(ContractDeactivationReason), dto.Reason))
            return ApiResult<int>.Failure(["Noto'g'ri sabab tanlandi."], 400);

        var note = dto.Note?.Trim();
        if (dto.Reason == ContractDeactivationReason.Other && string.IsNullOrWhiteSpace(note))
            return ApiResult<int>.Failure(["Iltimos, sababni qo'lda yozib qoldiring."], 400);

        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments)
            .Include(c => c.ContractUsers)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers)
            .Include(c => c.TechProcesses)
            .Include(c => c.TechnicalDrawings)
            .Include(c => c.CostNorms).ThenInclude(cn => cn.Items)
            .Include(c => c.ContractTasks).ThenInclude(ct => ct.DailyLogs)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        contract.IsActive = false;
        contract.DeactivationReason = dto.Reason;
        contract.DeactivationNote = note;
        contract.DeactivatedAt = DateTime.UtcNow;

        foreach (var cd in contract.ContractDepartments) cd.IsActive = false;
        foreach (var cu in contract.ContractUsers) cu.IsActive = false;
        foreach (var p in contract.Products)
        {
            p.IsActive = false;
            p.Status = ContractProductStatus.Cancelled;
            foreach (var pd in p.ProductDepartments) pd.IsActive = false;
            foreach (var pu in p.ProductUsers) pu.IsActive = false;
        }
        foreach (var tp in contract.TechProcesses) tp.IsActive = false;
        foreach (var td in contract.TechnicalDrawings) td.IsActive = false;
        foreach (var cn in contract.CostNorms)
        {
            cn.IsActive = false;
            foreach (var item in cn.Items) item.IsActive = false;
        }
        foreach (var ct in contract.ContractTasks)
        {
            ct.IsActive = false;
            foreach (var log in ct.DailyLogs) log.IsActive = false;
        }

        await _context.SaveChangesAsync();

        var deactivateTitle = $"Shartnoma o'chirib qo'yildi: {contract.ContractNo}";
        var deactivateBody  = $"№{contract.ContractNo} shartnoma va unga bog'liq barcha ma'lumotlar nofaol holatga o'tkazildi.";

        var deactivateUserIds = contract.ContractUsers.Select(cu => cu.UserId).ToHashSet();
        var deactivateDeptUserIds = await _context.Users
            .Where(u => u.IsActive && contract.ContractDepartments.Select(cd => cd.DepartmentId).Contains(u.DepartmentId!.Value))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            deactivateUserIds.Union(deactivateDeptUserIds), deactivateTitle, deactivateBody, NotificationType.Warning, contract.Id);

        await _manufacturedProductService.SyncForContractAsync(contract.Id);

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> ActivateAsync(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments)
            .Include(c => c.ContractUsers)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers)
            .Include(c => c.TechProcesses)
            .Include(c => c.TechnicalDrawings)
            .Include(c => c.CostNorms).ThenInclude(cn => cn.Items)
            .Include(c => c.ContractTasks).ThenInclude(ct => ct.DailyLogs)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        if (contract.Status == ContractStatus.Completed)
            return ApiResult<int>.Failure(["Yakunlangan shartnomani qayta faollashtirib bo'lmaydi."], 400);

        if (await _context.Contracts.AnyAsync(c => c.ContractNo == contract.ContractNo && c.IsActive && c.Id != contract.Id))
            return ApiResult<int>.Failure(
                [$"«{contract.ContractNo}» raqamli aktiv shartnoma allaqachon mavjud. Avval uni arxivga o'tkazing yoki bu shartnoma raqamini o'zgartiring."],
                409);

        contract.IsActive = true;
        contract.DeactivationReason = null;
        contract.DeactivationNote = null;
        contract.DeactivatedAt = null;

        foreach (var cd in contract.ContractDepartments) cd.IsActive = true;
        foreach (var cu in contract.ContractUsers) cu.IsActive = true;
        foreach (var p in contract.Products)
        {
            p.IsActive = true;
            // Recompute the stage from current TP/CN/drawing state so the
            // product re-enters the workflow at the right place rather than
            // staying frozen at Cancelled.
            p.Status = await ResolveProductStageAsync(p.Id);
            foreach (var pd in p.ProductDepartments) pd.IsActive = true;
            foreach (var pu in p.ProductUsers) pu.IsActive = true;
        }
        foreach (var tp in contract.TechProcesses) tp.IsActive = true;
        foreach (var td in contract.TechnicalDrawings) td.IsActive = true;
        foreach (var cn in contract.CostNorms)
        {
            cn.IsActive = true;
            foreach (var item in cn.Items) item.IsActive = true;
        }
        foreach (var ct in contract.ContractTasks)
        {
            ct.IsActive = true;
            foreach (var log in ct.DailyLogs) log.IsActive = true;
        }

        await _context.SaveChangesAsync();

        // After per-product stages were rederived, the aggregate may differ
        // from the frozen pre-deactivation status.
        await ContractStatusHelper.RecomputeContractStatusAsync(_context, contract.Id);
        await _context.SaveChangesAsync();

        var activateTitle = $"Shartnoma faollashtirildi: {contract.ContractNo}";
        var activateBody  = $"№{contract.ContractNo} shartnoma qayta faol holatga o'tkazildi.";

        var activateUserIds = contract.ContractUsers.Select(cu => cu.UserId).ToHashSet();
        var activateDeptUserIds = await _context.Users
            .Where(u => u.IsActive && contract.ContractDepartments.Select(cd => cd.DepartmentId).Contains(u.DepartmentId!.Value))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            activateUserIds.Union(activateDeptUserIds), activateTitle, activateBody, NotificationType.Info, contract.Id);

        await _manufacturedProductService.SyncForContractAsync(contract.Id);

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<IEnumerable<ContractUserDto>>> GetUsersAsync(Guid contractId)
    {
        var exists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!exists)
            return ApiResult<IEnumerable<ContractUserDto>>.Failure([$"Contract '{contractId}' not found."], 404);

        var users = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .Include(cu => cu.User).ThenInclude(u => u.Department)
            .AsNoTracking()
            .Select(cu => new ContractUserDto
            {
                UserId         = cu.UserId,
                FullName       = $"{cu.User.FirstName} {cu.User.LastName}",
                DepartmentName = cu.User.Department != null ? cu.User.Department.Name : null,
                Role           = cu.Role,
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractUserDto>>.Success(users);
    }

    // Ishlab chiqarish bo'limi xodimining vazifalari. Faqat vazifalar jadvali
    // uchun kerak bo'lgan maydonlar qaytariladi.
    public async Task<ApiResult<IEnumerable<ContractSummaryDto>>> GetMyProductionTasksAsync(Guid userId, bool viewAll, bool? isActive = null)
    {
        Guid? userDeptId = null;
        var query = _context.Contracts.AsNoTracking();

        if (!viewAll)
        {
            var user = await _context.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.DepartmentId,
                    DepartmentType = u.Department != null ? (DepartmentType?)u.Department.Type : null,
                })
                .FirstOrDefaultAsync();

            if (user is null)
                return ApiResult<IEnumerable<ContractSummaryDto>>.Failure(["User not found."], 404);

            if (user.DepartmentType != DepartmentType.IshlabChiqarish)
                return ApiResult<IEnumerable<ContractSummaryDto>>.Success(Array.Empty<ContractSummaryDto>());

            userDeptId = user.DepartmentId;

            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == userId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == userId)));
        }

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new ContractSummaryDto
            {
                Id            = c.Id,
                ContractNo    = c.ContractNo,
                ContractParty = c.ContractParty,
                StartDate     = c.StartDate,
                EndDate       = c.EndDate,
                ContractType  = c.ContractType,
                Status        = c.Status,
                IsActive      = c.IsActive,
                // Faqat foydalanuvchi biriktirilgan mahsulotlar (shartnoma
                // darajasida biriktirilgan bo'lsa — hammasi).
                Products = c.Products
                    .Where(p => viewAll
                        || c.ContractUsers.Any(cu => cu.UserId == userId)
                        || c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId)
                        || p.ProductUsers.Any(pu => pu.UserId == userId)
                        || p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId))
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => new ContractSummaryProductDto
                    {
                        Id          = p.Id,
                        ProductType = p.ProductType,
                        Quantity    = p.Quantity,
                        Unit        = p.Unit,
                        Status      = p.Status,
                        // Jo'natish modali mahsulotning ishlab chiqarish bo'limini
                        // aniqlash uchun ishlatadi.
                        Departments = p.ProductDepartments
                            .Where(pd => pd.Department != null)
                            .Select(pd => new ContractDepartmentDto
                            {
                                Id   = pd.Department!.Id,
                                Name = pd.Department.Name,
                                Type = pd.Department.Type,
                            }).ToList(),
                    }).ToList(),
            })
            .ToListAsync();

        return ApiResult<IEnumerable<ContractSummaryDto>>.Success(contracts);
    }

    public async Task<ApiResult<PagedResult<ContractReadinessDto>>> GetReadinessOverviewAsync(Guid currentUserId, bool viewAll, PaginationParams pagination, string? search = null, bool? isActive = null)
    {
        Guid? userDeptId = viewAll ? null : await GetUserDepartmentIdAsync(currentUserId);

        var query = _context.Contracts.AsNoTracking();

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId)));
        }

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(c => c.ContractNo.ToLower().Contains(lower));
        }

        // Faqat qator qurish uchun kerak bo'lgan ustunlar tanlanadi — ilgari
        // bu yerda butun shartnoma grafi (xodimlar, bo'limlar) xotiraga yuklanardi.
        var contracts = await query
            .Select(c => new ReadinessContractRow
            {
                Id         = c.Id,
                ContractNo = c.ContractNo,
                IsActive   = c.IsActive,
                Products   = c.Products
                    .Where(p => viewAll
                        || c.ContractUsers.Any(cu => cu.UserId == currentUserId)
                        || c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId)
                        || p.ProductUsers.Any(pu => pu.UserId == currentUserId)
                        || p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId))
                    .OrderBy(p => p.OrderIndex)
                    .Select(p => new ReadinessProductRow
                    {
                        Id          = p.Id,
                        ProductType = p.ProductType,
                        Quantity    = p.Quantity,
                        Unit        = p.Unit,
                    }).ToList(),
            })
            .ToListAsync();

        var contractIds = contracts.Select(c => c.Id).ToList();

        var drawingsQuery = _context.TechnicalDrawings.AsNoTracking()
            .Where(d => contractIds.Contains(d.ContractId));
        var tpsQuery = _context.TechProcesses.AsNoTracking()
            .Where(t => contractIds.Contains(t.ContractId));
        var cnsQuery = _context.CostNorms.AsNoTracking()
            .Where(n => contractIds.Contains(n.ContractId));

        if (isActive.HasValue)
        {
            drawingsQuery = drawingsQuery.Where(d => d.IsActive == isActive.Value);
            tpsQuery = tpsQuery.Where(t => t.IsActive == isActive.Value);
            cnsQuery = cnsQuery.Where(n => n.IsActive == isActive.Value);
        }

        var drawings = await drawingsQuery
            .Select(d => new ContractReadinessDrawingRow(d.Id, d.ContractId, d.ContractProductId, d.Status))
            .ToListAsync();

        var techProcesses = await tpsQuery
            .Select(t => new ContractReadinessTechProcessRow(t.Id, t.ContractId, t.ContractProductId, t.Title, t.Notes, t.Status))
            .ToListAsync();

        var costNorms = await cnsQuery
            .Select(n => new ContractReadinessCostNormRow(n.Id, n.ContractId, n.ContractProductId, n.Title, n.Status, n.Items.Count))
            .ToListAsync();

        // Har bir scope uchun butun ro'yxatni skanerlash o'rniga (contract, mahsulot)
        // kaliti bo'yicha bir marta guruhlanadi — eng yaxshi nomzod shu yerda tanlanadi.
        var drawingByScope = drawings
            .GroupBy(d => (d.ContractId, d.ContractProductId))
            .ToDictionary(g => g.Key, g => g.OrderByDescending(d => (int)d.Status).First());

        var tpByScope = techProcesses
            .GroupBy(t => (t.ContractId, t.ContractProductId))
            .ToDictionary(g => g.Key, g => g.OrderByDescending(t => (int)t.Status).First());

        // Me'yoriy sarfda birinchi navbatda qatorlari bor varianti tanlanadi.
        var cnByScope = costNorms
            .GroupBy(n => (n.ContractId, n.ContractProductId))
            .ToDictionary(g => g.Key, g => g.FirstOrDefault(n => n.ItemCount > 0) ?? g.First());

        var scopes = new List<ContractReadinessDto>();
        foreach (var contract in contracts)
        {
            if (contract.Products.Count == 0)
            {
                scopes.Add(BuildReadinessScope(contract, null, drawingByScope, tpByScope, cnByScope));
            }
            else
            {
                foreach (var product in contract.Products)
                    scopes.Add(BuildReadinessScope(contract, product, drawingByScope, tpByScope, cnByScope));
            }
        }

        var ordered = scopes
            .OrderBy(s => s.Priority)
            .ThenBy(s => s.ContractNo, StringComparer.OrdinalIgnoreCase)
            .ThenBy(s => s.ContractProductId == null ? 0 : 1)
            .ThenBy(s => s.ProductType, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalCount = ordered.Count;
        var pageItems = ordered
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToList();

        var paged = PagedResult<ContractReadinessDto>.Create(pageItems, totalCount, pagination);
        return ApiResult<PagedResult<ContractReadinessDto>>.Success(paged);
    }

    private sealed class ReadinessContractRow
    {
        public Guid Id { get; set; }
        public string ContractNo { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public List<ReadinessProductRow> Products { get; set; } = [];
    }

    private sealed class ReadinessProductRow
    {
        public Guid Id { get; set; }
        public string ProductType { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string Unit { get; set; } = string.Empty;
    }

    private record ContractReadinessDrawingRow(Guid Id, Guid ContractId, Guid? ContractProductId, DrawingStatus Status);
    private record ContractReadinessTechProcessRow(Guid Id, Guid ContractId, Guid? ContractProductId, string Title, string? Notes, ProcessStatus Status);
    private record ContractReadinessCostNormRow(Guid Id, Guid ContractId, Guid? ContractProductId, string Title, DrawingStatus Status, int ItemCount);

    private static ContractReadinessDto BuildReadinessScope(
        ReadinessContractRow contract,
        ReadinessProductRow? product,
        Dictionary<(Guid, Guid?), ContractReadinessDrawingRow> drawingByScope,
        Dictionary<(Guid, Guid?), ContractReadinessTechProcessRow> tpByScope,
        Dictionary<(Guid, Guid?), ContractReadinessCostNormRow> cnByScope)
    {
        var key = (contract.Id, product?.Id);

        drawingByScope.TryGetValue(key, out var bestDrawing);
        tpByScope.TryGetValue(key, out var bestTp);
        cnByScope.TryGetValue(key, out var bestCn);

        var dto = new ContractReadinessDto
        {
            ContractId = contract.Id,
            ContractNo = contract.ContractNo,
            ContractIsActive = contract.IsActive,
            ContractProductId = product?.Id,
            ProductType = product?.ProductType,
            ProductQuantity = product?.Quantity,
            ProductUnit = product?.Unit,
            Drawing = bestDrawing is null ? null : new ContractReadinessDrawingDto
            {
                Id = bestDrawing.Id,
                Status = bestDrawing.Status,
            },
            TechProcess = bestTp is null ? null : new ContractReadinessTechProcessDto
            {
                Id = bestTp.Id,
                Title = bestTp.Title,
                Notes = bestTp.Notes,
                Status = bestTp.Status,
            },
            CostNorm = bestCn is null ? null : new ContractReadinessCostNormDto
            {
                Id = bestCn.Id,
                Title = bestCn.Title,
                Status = bestCn.Status,
                ItemCount = bestCn.ItemCount,
            },
        };

        dto.Priority = ComputeReadinessPriority(dto);
        return dto;
    }

    private static int ComputeReadinessPriority(ContractReadinessDto s)
    {
        var drawingApproved = s.Drawing?.Status == DrawingStatus.Approved;
        var tpEffective = s.TechProcess is { Status: not ProcessStatus.Pending } ? s.TechProcess : null;
        var cnEffective = s.CostNorm is { ItemCount: > 0 } ? s.CostNorm : null;
        var tpDone = tpEffective is { Status: ProcessStatus.Approved or ProcessStatus.Completed };
        var cnDone = cnEffective is { Status: DrawingStatus.Approved };

        // 0: chizma tasdiqlangan, lekin TP yoki CN tasdiqlanmagan
        if (drawingApproved && !(tpDone && cnDone)) return 0;
        // 1: chizma yaratilgan, lekin tasdiqlanmagan
        if (s.Drawing is { } d && d.Status != DrawingStatus.Approved) return 1;
        // 2: chizma yaratilmagan
        if (s.Drawing is null) return 2;
        // 3: to'liq yakunlangan
        return 3;
    }

    private static ContractResponseDto MapToResponse(Contract contract) => new()
    {
        Id = contract.Id,
        ContractNo = contract.ContractNo,
        StartDate = contract.StartDate,
        EndDate = contract.EndDate,
        Departments = contract.ContractDepartments
            .Where(cd => cd.Department is not null)
            .Select(cd => new ContractDepartmentDto
            {
                Id   = cd.Department.Id,
                Name = cd.Department.Name,
                Type = cd.Department.Type,
            }).ToList(),
        ContractType = contract.ContractType,
        ContractParty = contract.ContractParty,
        Status = contract.Status,
        Notes = contract.Notes,
        IsActive = contract.IsActive,
        CreatedByFullName = contract.Creator is not null
            ? $"{contract.Creator.FirstName} {contract.Creator.LastName}"
            : null,
        AssignedUsers = contract.ContractUsers
            .Select(cu => new ContractUserDto
            {
                UserId         = cu.UserId,
                FullName       = $"{cu.User!.FirstName} {cu.User.LastName}",
                DepartmentName = cu.User.Department?.Name,
                Role           = cu.Role,
            }).ToList(),
        Products = contract.Products
            .OrderBy(p => p.OrderIndex)
            .Select(p => new ContractProductResponseDto
            {
                Id          = p.Id,
                ContractId  = p.ContractId,
                ProductCatalogId = p.ProductCatalogId,
                ProductCode = p.ProductCatalog != null ? p.ProductCatalog.Code : null,
                ProductType = p.ProductType,
                Quantity    = p.Quantity,
                Unit        = p.Unit,
                OrderIndex  = p.OrderIndex,
                Notes       = p.Notes,
                Status      = p.Status,
                Departments = p.ProductDepartments
                    .Where(pd => pd.Department is not null)
                    .Select(pd => new ContractDepartmentDto
                    {
                        Id   = pd.Department.Id,
                        Name = pd.Department.Name,
                        Type = pd.Department.Type,
                    }).ToList(),
                AssignedUsers = p.ProductUsers
                    .Where(pu => pu.User is not null)
                    .Select(pu => new ContractUserDto
                    {
                        UserId         = pu.UserId,
                        FullName       = $"{pu.User!.FirstName} {pu.User.LastName}",
                        DepartmentName = pu.User.Department?.Name,
                        Role           = pu.Role,
                    }).ToList(),
            }).ToList(),
    };
}
