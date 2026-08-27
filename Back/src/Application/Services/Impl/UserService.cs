using Application.DTOs;
using Application.DTOs.Users;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Application.Services.Impl;

public class UserService : IUserService
{
    private readonly DatabaseContext _context;
    private readonly IMemoryCache _cache;
    private const string LookupCacheKey = "user_lookup";

    // Compiled once at startup — EF Core does not re-translate this query on every call
    private static readonly Func<DatabaseContext, IAsyncEnumerable<UserLookupDto>> CompiledLookup =
        EF.CompileAsyncQuery((DatabaseContext db) =>
            db.Users
              .AsNoTracking()
              .Where(u => u.IsActive)
              .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
              .Select(u => new UserLookupDto
              {
                  Id             = u.Id,
                  FirstName      = u.FirstName,
                  LastName       = u.LastName,
                  DepartmentId   = u.Department != null ? (Guid?)u.Department.Id : null,
                  DepartmentName = u.Department != null ? u.Department.Name : null,
                  DepartmentType = u.Department != null ? (Core.Enums.DepartmentType?)u.Department.Type : null,
              }));

    public UserService(DatabaseContext context, IMemoryCache cache)
    {
        _context = context;
        _cache   = cache;
    }

    // Faqat DTO maydonlari SELECT qilinadi — PasswordHash/LockoutEnd va to'liq
    // Role/Department qatorlari bazadan umuman o'qilmaydi.
    public async Task<ApiResult<PagedResult<UserResponseDto>>> GetAllAsync(PaginationParams pagination)
    {
        var totalCount = await _context.Users.CountAsync();

        var users = await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(u => new UserResponseDto
            {
                Id             = u.Id,
                FirstName      = u.FirstName,
                LastName       = u.LastName,
                Login          = u.Login,
                RoleId         = u.RoleId,
                RoleName       = u.Role != null ? u.Role.Name : null,
                DepartmentId   = u.DepartmentId,
                DepartmentName = u.Department != null ? u.Department.Name : null,
                IsActive       = u.IsActive,
                IsHead         = u.IsHead,
            })
            .ToListAsync();

        return ApiResult<PagedResult<UserResponseDto>>.Success(
            PagedResult<UserResponseDto>.Create(users, totalCount, pagination));
    }

    public async Task<ApiResult<IEnumerable<UserLookupDto>>> GetLookupAsync()
    {
        if (_cache.TryGetValue(LookupCacheKey, out List<UserLookupDto>? cached))
            return ApiResult<IEnumerable<UserLookupDto>>.Success(cached!);

        var users = new List<UserLookupDto>();
        await foreach (var u in CompiledLookup(_context))
            users.Add(u);

        _cache.Set(LookupCacheKey, users, TimeSpan.FromMinutes(5));

        return ApiResult<IEnumerable<UserLookupDto>>.Success(users);
    }

    // Xodimlar sahifasi uchun — login/rol kabi maxfiy maydonlarsiz, shartnoma soni bilan.
    public async Task<ApiResult<PagedResult<EmployeeResponseDto>>> GetEmployeesAsync(PaginationParams pagination)
    {
        var totalCount = await _context.Users.CountAsync();

        var users = await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .Select(u => new EmployeeResponseDto
            {
                Id             = u.Id,
                FirstName      = u.FirstName,
                LastName       = u.LastName,
                DepartmentName = u.Department != null ? u.Department.Name : null,
                DepartmentType = u.Department != null ? (DepartmentType?)u.Department.Type : null,
                IsActive       = u.IsActive,
            })
            .ToListAsync();

        var contractCounts = await GetActiveContractCountsAsync(users.Select(u => u.Id).ToList());
        foreach (var u in users)
            u.ActiveContractCount = contractCounts.GetValueOrDefault(u.Id);

        return ApiResult<PagedResult<EmployeeResponseDto>>.Success(
            PagedResult<EmployeeResponseDto>.Create(users, totalCount, pagination));
    }

    // Xodim ishlayotgan shartnomalar: ContractUser (shartnoma darajasi) va
    // ContractProductUser (mahsulot darajasi) yozuvlari shartnoma bo'yicha birlashtiriladi.
    public async Task<ApiResult<IEnumerable<UserContractDto>>> GetContractsAsync(Guid id)
    {
        var direct = await _context.ContractUsers
            .AsNoTracking()
            .Where(cu => cu.UserId == id && cu.IsActive)
            .Select(cu => new
            {
                cu.Contract.Id,
                cu.Contract.ContractNo,
                cu.Contract.ContractParty,
                cu.Contract.ContractType,
                cu.Contract.Status,
                cu.Contract.StartDate,
                cu.Contract.EndDate,
                cu.Contract.IsActive,
                cu.Contract.CreatedAt,
                cu.Role,
            })
            .ToListAsync();

        var viaProducts = await _context.ContractProductUsers
            .AsNoTracking()
            .Where(pu => pu.UserId == id && pu.IsActive && pu.Product.IsActive)
            .Select(pu => new
            {
                ContractId = pu.Product.Contract!.Id,
                pu.Product.Contract.ContractNo,
                pu.Product.Contract.ContractParty,
                pu.Product.Contract.ContractType,
                ContractStatus = pu.Product.Contract.Status,
                pu.Product.Contract.StartDate,
                pu.Product.Contract.EndDate,
                ContractIsActive = pu.Product.Contract.IsActive,
                pu.Product.Contract.CreatedAt,
                Product = new UserContractProductDto
                {
                    ContractProductId = pu.ContractProductId,
                    ProductType = pu.Product.ProductType,
                    Quantity = pu.Product.Quantity,
                    Unit = pu.Product.Unit,
                    Status = pu.Product.Status,
                    Role = pu.Role,
                },
            })
            .ToListAsync();

        var map = new Dictionary<Guid, (UserContractDto Dto, DateTime CreatedAt)>();

        foreach (var c in direct)
        {
            if (!map.TryGetValue(c.Id, out var entry))
            {
                entry = (new UserContractDto
                {
                    ContractId = c.Id,
                    ContractNo = c.ContractNo,
                    ContractParty = c.ContractParty,
                    ContractType = c.ContractType,
                    Status = c.Status,
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    IsActive = c.IsActive,
                }, c.CreatedAt);
                map[c.Id] = entry;
            }
            entry.Dto.ContractRole = c.Role;
        }

        foreach (var p in viaProducts)
        {
            if (!map.TryGetValue(p.ContractId, out var entry))
            {
                entry = (new UserContractDto
                {
                    ContractId = p.ContractId,
                    ContractNo = p.ContractNo,
                    ContractParty = p.ContractParty,
                    ContractType = p.ContractType,
                    Status = p.ContractStatus,
                    StartDate = p.StartDate,
                    EndDate = p.EndDate,
                    IsActive = p.ContractIsActive,
                }, p.CreatedAt);
                map[p.ContractId] = entry;
            }
            entry.Dto.Products.Add(p.Product);
        }

        var result = map.Values
            .OrderByDescending(x => x.Dto.IsActive
                && x.Dto.Status != ContractStatus.Completed
                && x.Dto.Status != ContractStatus.Cancelled)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => x.Dto)
            .ToList();

        return ApiResult<IEnumerable<UserContractDto>>.Success(result);
    }

    // Sahifadagi xodimlar uchun faol (yakunlanmagan) shartnomalar sonini bitta so'rovda hisoblaydi.
    private async Task<Dictionary<Guid, int>> GetActiveContractCountsAsync(List<Guid> userIds)
    {
        if (userIds.Count == 0)
            return [];

        var direct = _context.ContractUsers
            .Where(cu => userIds.Contains(cu.UserId) && cu.IsActive
                && cu.Contract.IsActive
                && cu.Contract.Status != ContractStatus.Completed
                && cu.Contract.Status != ContractStatus.Cancelled)
            .Select(cu => new { cu.UserId, cu.ContractId });

        var viaProducts = _context.ContractProductUsers
            .Where(pu => userIds.Contains(pu.UserId) && pu.IsActive
                && pu.Product.IsActive
                && pu.Product.Contract!.IsActive
                && pu.Product.Contract.Status != ContractStatus.Completed
                && pu.Product.Contract.Status != ContractStatus.Cancelled)
            .Select(pu => new { pu.UserId, pu.Product.ContractId });

        return await direct.Union(viaProducts)
            .GroupBy(x => x.UserId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
    }

    private static bool IsPasswordStrong(string password) =>
        password.Length >= 8 &&
        password.Any(char.IsUpper) &&
        password.Any(char.IsLower) &&
        password.Any(char.IsDigit) &&
        password.Any(c => !char.IsLetterOrDigit(c));

    public async Task<ApiResult<int>> CreateAsync(UserCreateDto dto)
    {
        if (!IsPasswordStrong(dto.Password))
            return ApiResult<int>.Failure(["Parol yetarlicha kuchli emas. Kamida 8 ta belgi, katta va kichik harf, raqam va maxsus belgi bo'lishi kerak."]);

        if (await _context.Users.AnyAsync(u => u.Login == dto.Login))
            return ApiResult<int>.Failure([$"Login '{dto.Login}' is already taken."]);

        if (dto.IsHead && dto.DepartmentId.HasValue)
        {
            // Faqat ism-familiya kerak — butun User qatorini o'qishning hojati yo'q.
            var previousHead = await _context.Users
                .AsNoTracking()
                .Where(u => u.DepartmentId == dto.DepartmentId && u.IsHead)
                .Select(u => u.FirstName + " " + u.LastName)
                .FirstOrDefaultAsync();
            if (previousHead is not null)
                return ApiResult<int>.Failure([$"Ushbu bo'limda allaqachon rahbar mavjud: {previousHead}. Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang."]);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Login = dto.Login,
            PasswordHash = PasswordHelper.HashPassword(dto.Password),
            RoleId = dto.RoleId,
            DepartmentId = dto.DepartmentId,
            IsHead = dto.IsHead,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(201);
    }

    private static readonly Guid SuperAdminId = new("00000000-0000-0000-0000-000000000001");

    public async Task<ApiResult<int>> UpdateAsync(Guid id, UserUpdateDto dto)
    {
        if (id == SuperAdminId)
            return ApiResult<int>.Failure(["SuperAdmin foydalanuvchisini tahrirlash mumkin emas."], statusCode: 403);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

        if (user is null)
            return ApiResult<int>.Failure([$"User with id '{id}' not found."]);

        if (dto.Login is not null && dto.Login != user.Login)
        {
            if (await _context.Users.AnyAsync(u => u.Login == dto.Login))
                return ApiResult<int>.Failure([$"Login '{dto.Login}' is already taken."]);

            user.Login = dto.Login;
        }

        if (dto.FirstName is not null) user.FirstName = dto.FirstName;
        if (dto.LastName is not null) user.LastName = dto.LastName;
        if (dto.Password is not null)
        {
            if (!IsPasswordStrong(dto.Password))
                return ApiResult<int>.Failure(["Parol yetarlicha kuchli emas. Kamida 8 ta belgi, katta va kichik harf, raqam va maxsus belgi bo'lishi kerak."]);
            user.PasswordHash = PasswordHelper.HashPassword(dto.Password);
        }
        if (dto.RoleId.HasValue) user.RoleId = dto.RoleId;
        if (dto.DepartmentId.HasValue) user.DepartmentId = dto.DepartmentId;
        if (dto.IsActive.HasValue)
        {
            user.IsActive = dto.IsActive.Value;
            if (!dto.IsActive.Value)
                user.IsHead = false;
        }

        if (dto.IsHead.HasValue)
        {
            if (dto.IsHead.Value && user.DepartmentId.HasValue)
            {
                var previousHead = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.DepartmentId == user.DepartmentId && u.IsHead && u.Id != id)
                    .Select(u => u.FirstName + " " + u.LastName)
                    .FirstOrDefaultAsync();
                if (previousHead is not null)
                    return ApiResult<int>.Failure([$"Ushbu bo'limda allaqachon rahbar mavjud: {previousHead}. Yangi rahbar belgilash uchun avval mavjud rahbarni olib tashlang."]);
            }
            user.IsHead = dto.IsHead.Value;
        }

        await _context.SaveChangesAsync();
        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(200);
    }

    // Aktivlashtirish/deaktivatsiya — bitta UPDATE bilan, User qatorini o'qimasdan.
    // Deaktivatsiyada rahbarlik ham olib tashlanadi (UpdateAsync bilan bir xil xatti-harakat).
    public async Task<ApiResult<int>> SetActiveAsync(Guid id, bool isActive)
    {
        if (id == SuperAdminId)
            return ApiResult<int>.Failure(["SuperAdmin foydalanuvchisini tahrirlash mumkin emas."], statusCode: 403);

        var affected = isActive
            ? await _context.Users
                .Where(u => u.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, true))
            : await _context.Users
                .Where(u => u.Id == id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.IsActive, false)
                    .SetProperty(u => u.IsHead, false));

        if (affected == 0)
            return ApiResult<int>.Failure([$"User with id '{id}' not found."]);

        _cache.Remove(LookupCacheKey);

        return ApiResult<int>.Success(200);
    }
}
