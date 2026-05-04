using Application.DTOs;
using Application.DTOs.Contracts;
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

    public ContractService(
        DatabaseContext context,
        INotificationService notificationService,
        IManufacturedProductService manufacturedProductService)
    {
        _context = context;
        _notificationService = notificationService;
        _manufacturedProductService = manufacturedProductService;
    }

    public async Task<ApiResult<IEnumerable<ContractResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ContractStatus? status = null, Guid? departmentId = null, bool? isActive = null)
    {
        var query = _context.Contracts
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments).ThenInclude(pd => pd.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers).ThenInclude(pu => pu.User).ThenInclude(u => u.Department)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
        {
            query = query.Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                c.ContractDepartments.Any(cd =>
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd =>
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))));
        }

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (departmentId.HasValue)
            query = query.Where(c =>
                c.ContractDepartments.Any(cd => cd.DepartmentId == departmentId.Value) ||
                c.Products.Any(p => p.ProductDepartments.Any(pd => pd.DepartmentId == departmentId.Value)));

        if (isActive.HasValue)
            query = query.Where(c => c.IsActive == isActive.Value);

        var contracts = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        // For non-admin users, hide products they aren't assigned to (by user-role or department-of-user).
        if (!viewAll)
            FilterVisibleProducts(contracts, currentUserId);

        return ApiResult<IEnumerable<ContractResponseDto>>.Success(contracts.Select(MapToResponse));
    }

    private void FilterVisibleProducts(List<Contract> contracts, Guid currentUserId)
    {
        var userDeptId = _context.Users.AsNoTracking()
            .Where(u => u.Id == currentUserId)
            .Select(u => u.DepartmentId)
            .FirstOrDefault();

        foreach (var c in contracts)
        {
            // If the user is directly attached to the contract (legacy or contract-wide role), show all products.
            var directContractAccess = c.ContractUsers.Any(cu => cu.UserId == currentUserId)
                || (userDeptId.HasValue && c.ContractDepartments.Any(cd => cd.DepartmentId == userDeptId.Value));
            if (directContractAccess) continue;

            c.Products = c.Products
                .Where(p =>
                    p.ProductUsers.Any(pu => pu.UserId == currentUserId) ||
                    (userDeptId.HasValue && p.ProductDepartments.Any(pd => pd.DepartmentId == userDeptId.Value)))
                .ToList();
        }
    }

    public async Task<ApiResult<ContractResponseDto>> GetByIdAsync(Guid id)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .Include(c => c.ContractUsers).ThenInclude(cu => cu.User).ThenInclude(u => u!.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments).ThenInclude(pd => pd.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers).ThenInclude(pu => pu.User).ThenInclude(u => u!.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<ContractResponseDto>.Failure([$"Contract with id '{id}' not found."], 404);

        return ApiResult<ContractResponseDto>.Success(MapToResponse(contract));
    }

    public async Task<ApiResult<ContractCreateResultDto>> CreateAsync(ContractCreateDto dto, Guid createdBy)
    {
        if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo))
            return ApiResult<ContractCreateResultDto>.Failure([$"Contract with number '{dto.ContractNo}' already exists."]);

        var validationErrors = await ValidateProductsAsync(dto.Products);
        if (validationErrors.Count > 0)
            return ApiResult<ContractCreateResultDto>.Failure(validationErrors, 400);

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractNo = dto.ContractNo,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Priority = dto.Priority,
            ContractParty = dto.ContractParty,
            Status = ContractStatus.Draft,
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

        if (dto.ContractNo is not null && dto.ContractNo != contract.ContractNo)
        {
            if (await _context.Contracts.AnyAsync(c => c.ContractNo == dto.ContractNo))
                return ApiResult<ContractCreateResultDto>.Failure([$"Contract with number '{dto.ContractNo}' already exists."]);

            contract.ContractNo = dto.ContractNo;
        }

        if (dto.StartDate.HasValue) contract.StartDate = dto.StartDate.Value;
        if (dto.EndDate.HasValue) contract.EndDate = dto.EndDate.Value;
        if (dto.Priority.HasValue) contract.Priority = dto.Priority.Value;
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

    public async Task<ApiResult<int>> UpdateStatusAsync(Guid id, ContractStatus status)
    {
        var contract = await _context.Contracts
            .Include(c => c.ContractDepartments)
            .Include(c => c.ContractUsers)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (contract is null)
            return ApiResult<int>.Failure([$"Contract with id '{id}' not found."], 404);

        contract.Status = status;
        await _context.SaveChangesAsync();

        if (status != ContractStatus.DrawingPending)
        {
            var title = $"Shartnoma holati o'zgardi: {contract.ContractNo}";
            var body  = $"{contract.ContractNo} shartnoma holati «{status}» ga o'zgartirildi.";

            var userIds = contract.ContractUsers.Select(cu => cu.UserId).ToHashSet();

            var deptUserIds = await _context.Users
                .Where(u => u.IsActive && contract.ContractDepartments.Select(cd => cd.DepartmentId).Contains(u.DepartmentId!.Value))
                .Select(u => u.Id)
                .ToListAsync();

            await _notificationService.NotifyUsersAndSuperAdminsAsync(
                userIds.Union(deptUserIds), title, body, NotificationType.Info, contract.Id);
        }

        if (status == ContractStatus.TechProcessing)
            await TryAdvanceToProductionAsync(contract);

        await _manufacturedProductService.SyncForContractAsync(contract.Id);

        return ApiResult<int>.Success(200);
    }

    private async System.Threading.Tasks.Task TryAdvanceToProductionAsync(Contract contract)
    {
        if (contract.Status != ContractStatus.TechProcessing)
            return;

        if (!await IsContractFullyReadyForProductionAsync(contract.Id))
            return;

        contract.Status = ContractStatus.InProduction;
        await _context.SaveChangesAsync();
    }

    // Kontrakt InProduction'ga o'tishi uchun har bir mahsulot alohida tasdiqlangan bo'lishi shart.
    // Mahsulotsiz kontraktlarda esa kontrakt darajasidagi bitta Approved TP + Approved CN yetadi.
    private async Task<bool> IsContractFullyReadyForProductionAsync(Guid contractId)
    {
        var productIds = await _context.ContractProducts
            .Where(p => p.ContractId == contractId)
            .Select(p => p.Id)
            .ToListAsync();

        if (productIds.Count == 0)
        {
            var tpOk = await _context.TechProcesses
                .AnyAsync(t => t.ContractId == contractId && t.Status == ProcessStatus.Approved);
            var cnOk = await _context.CostNorms
                .AnyAsync(c => c.ContractId == contractId && c.Status == DrawingStatus.Approved);
            return tpOk && cnOk;
        }

        var approvedTpProductIds = await _context.TechProcesses
            .Where(t => t.ContractId == contractId
                && t.Status == ProcessStatus.Approved
                && t.ContractProductId != null)
            .Select(t => t.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var approvedCnProductIds = await _context.CostNorms
            .Where(c => c.ContractId == contractId
                && c.Status == DrawingStatus.Approved
                && c.ContractProductId != null)
            .Select(c => c.ContractProductId!.Value)
            .Distinct()
            .ToListAsync();

        var tpSet = approvedTpProductIds.ToHashSet();
        var cnSet = approvedCnProductIds.ToHashSet();
        return productIds.All(pid => tpSet.Contains(pid) && cnSet.Contains(pid));
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

        contract.IsActive = true;
        contract.DeactivationReason = null;
        contract.DeactivationNote = null;
        contract.DeactivatedAt = null;

        foreach (var cd in contract.ContractDepartments) cd.IsActive = true;
        foreach (var cu in contract.ContractUsers) cu.IsActive = true;
        foreach (var p in contract.Products)
        {
            p.IsActive = true;
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

    public async Task<ApiResult<int>> AssignUsersAsync(Guid contractId, List<ContractUserAssignItem> users)
    {
        var exists = await _context.Contracts.AnyAsync(c => c.Id == contractId);
        if (!exists)
            return ApiResult<int>.Failure([$"Contract '{contractId}' not found."], 404);

        var existing = await _context.ContractUsers
            .Where(cu => cu.ContractId == contractId)
            .ToListAsync();

        var newlyAssigned = new List<Guid>();

        foreach (var item in users.DistinctBy(u => u.UserId))
        {
            var ex = existing.FirstOrDefault(e => e.UserId == item.UserId);
            if (ex is null)
            {
                _context.ContractUsers.Add(new ContractUser
                {
                    ContractId = contractId,
                    UserId     = item.UserId,
                    Role       = item.Role,
                });
                newlyAssigned.Add(item.UserId);
            }
            else
            {
                ex.Role = item.Role;
            }
        }

        await _context.SaveChangesAsync();

        if (newlyAssigned.Count > 0)
        {
            var contract = await _context.Contracts.AsNoTracking().FirstOrDefaultAsync(c => c.Id == contractId);
            foreach (var uid in newlyAssigned)
            {
                await _notificationService.CreateAsync(
                    uid,
                    $"Shartnomaga tayinlandingiz: {contract?.ContractNo}",
                    $"Sizga «{contract?.ContractNo}» shartnomasi bo'yicha vazifa berildi.",
                    NotificationType.Task,
                    contractId);
            }

            // SuperAdminlarga faqat allaqachon tayinlanmagan (va notification olgan)laridan tashqarisiga yuboramiz
            var superAdminRoleId = new Guid("00000000-0000-0000-0000-000000000001");
            var newlyAssignedSet = newlyAssigned.ToHashSet();
            var superAdminObservers = await _context.Users
                .Where(u => u.IsActive && u.RoleId == superAdminRoleId && !newlyAssignedSet.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            foreach (var uid in superAdminObservers)
            {
                await _notificationService.CreateAsync(
                    uid,
                    $"Shartnomaga yangi xodimlar tayinlandi: {contract?.ContractNo}",
                    $"«{contract?.ContractNo}» shartnomasi uchun {newlyAssigned.Count} ta yangi xodim tayinlandi.",
                    NotificationType.Task,
                    contractId);
            }
        }

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> RemoveUserAsync(Guid contractId, Guid userId)
    {
        var row = await _context.ContractUsers
            .FirstOrDefaultAsync(cu => cu.ContractId == contractId && cu.UserId == userId);

        if (row is null)
            return ApiResult<int>.Failure(["Assignment not found."], 404);

        _context.ContractUsers.Remove(row);
        await _context.SaveChangesAsync();

        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<IEnumerable<ContractResponseDto>>> GetMyProductionTasksAsync(Guid userId, bool viewAll, bool? isActive = null)
    {
        if (viewAll)
        {
            var allContractsQuery = _context.Contracts
                .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
                .Include(c => c.Creator)
                .Include(c => c.ContractUsers).ThenInclude(cu => cu.User).ThenInclude(u => u!.Department)
                .Include(c => c.Products).ThenInclude(p => p.ProductDepartments).ThenInclude(pd => pd.Department)
                .Include(c => c.Products).ThenInclude(p => p.ProductUsers).ThenInclude(pu => pu.User).ThenInclude(u => u!.Department)
                .AsNoTracking()
                .AsQueryable();

            if (isActive.HasValue)
                allContractsQuery = allContractsQuery.Where(c => c.IsActive == isActive.Value);

            var allContracts = await allContractsQuery
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return ApiResult<IEnumerable<ContractResponseDto>>.Success(allContracts.Select(MapToResponse));
        }

        var user = await _context.Users
            .Include(u => u.Department)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
            return ApiResult<IEnumerable<ContractResponseDto>>.Failure(["User not found."], 404);

        if (user.Department is null || user.Department.Type != Core.Enums.DepartmentType.IshlabChiqarish)
            return ApiResult<IEnumerable<ContractResponseDto>>.Success(Enumerable.Empty<ContractResponseDto>());

        var contractsQuery = _context.Contracts
            .Where(c =>
                c.ContractUsers.Any(cu => cu.UserId == userId) ||
                c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == userId)))
            .Include(c => c.ContractDepartments).ThenInclude(cd => cd.Department)
            .Include(c => c.Creator)
            .Include(c => c.ContractUsers).ThenInclude(cu => cu.User).ThenInclude(u => u!.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductDepartments).ThenInclude(pd => pd.Department)
            .Include(c => c.Products).ThenInclude(p => p.ProductUsers).ThenInclude(pu => pu.User).ThenInclude(u => u!.Department)
            .AsNoTracking();

        if (isActive.HasValue)
            contractsQuery = contractsQuery.Where(c => c.IsActive == isActive.Value);

        var contracts = await contractsQuery
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        // Show only the products this user is assigned to (or fall back to contract-level assignment).
        FilterVisibleProducts(contracts, userId);

        return ApiResult<IEnumerable<ContractResponseDto>>.Success(contracts.Select(MapToResponse));
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
        Priority = contract.Priority,
        ContractParty = contract.ContractParty,
        Status = contract.Status,
        Notes = contract.Notes,
        IsActive = contract.IsActive,
        DeactivationReason = contract.DeactivationReason,
        DeactivationNote = contract.DeactivationNote,
        DeactivatedAt = contract.DeactivatedAt,
        CreatedBy = contract.CreatedBy,
        CreatedByFullName = contract.Creator is not null
            ? $"{contract.Creator.FirstName} {contract.Creator.LastName}"
            : null,
        CreatedAt = contract.CreatedAt,
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
                ProductType = p.ProductType,
                Quantity    = p.Quantity,
                Unit        = p.Unit,
                OrderIndex  = p.OrderIndex,
                Notes       = p.Notes,
                Departments = p.ProductDepartments
                    .Where(pd => pd.Department is not null)
                    .Select(pd => new ContractProductDepartmentDto
                    {
                        Id   = pd.Department.Id,
                        Name = pd.Department.Name,
                        Type = pd.Department.Type,
                    }).ToList(),
                AssignedUsers = p.ProductUsers
                    .Where(pu => pu.User is not null)
                    .Select(pu => new ContractProductUserDto
                    {
                        UserId         = pu.UserId,
                        FullName       = $"{pu.User!.FirstName} {pu.User.LastName}",
                        DepartmentName = pu.User.Department?.Name,
                        Role           = pu.Role,
                    }).ToList(),
            }).ToList(),
    };
}
