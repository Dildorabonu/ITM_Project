using Application.DTOs;
using Application.DTOs.Requisitions;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using QRCoder;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Application.Services.Impl;

public class RequisitionService : IRequisitionService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;

    public RequisitionService(DatabaseContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<ApiResult<IEnumerable<RequisitionResponseDto>>> GetAllAsync(
        Guid currentUserId, bool viewAll, RequisitionStatus? status = null)
    {
        var query = _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
            query = query.Where(r => r.CreatedBy == currentUserId);

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        var list = await query.OrderByDescending(r => r.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<RequisitionResponseDto>>.Success(list.Select(MapToResponse));
    }

    private static readonly RequisitionStatus[] TerminalStatuses =
    [
        RequisitionStatus.ReadyForWarehouseRelease,
        RequisitionStatus.ReadyForPurchase,
        RequisitionStatus.Rejected,
    ];

    public async Task<ApiResult<PagedResult<RequisitionResponseDto>>> GetPagedAsync(
        Guid currentUserId,
        bool viewAll,
        PaginationParams pagination,
        string? search = null,
        RequisitionStatus? status = null,
        bool? completed = null)
    {
        var query = _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .AsNoTracking()
            .Where(r => r.ParentRequisitionId == null);

        if (!viewAll)
            query = query.Where(r => r.CreatedBy == currentUserId);

        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        if (completed.HasValue)
        {
            if (completed.Value)
            {
                query = query.Where(r =>
                    r.Children.Any()
                        ? r.Children.All(c => TerminalStatuses.Contains(c.Status))
                        : TerminalStatuses.Contains(r.Status));
            }
            else
            {
                query = query.Where(r =>
                    r.Children.Any()
                        ? r.Children.Any(c => !TerminalStatuses.Contains(c.Status))
                        : !TerminalStatuses.Contains(r.Status));
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(r =>
                r.RequisitionNo.ToLower().Contains(lower) ||
                r.Purpose.ToLower().Contains(lower) ||
                (r.Contract != null && r.Contract.ContractNo.ToLower().Contains(lower)) ||
                (r.Department != null && r.Department.Name.ToLower().Contains(lower)) ||
                (r.Creator != null && (r.Creator.FirstName + " " + r.Creator.LastName).ToLower().Contains(lower)));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(r =>
                r.Status == RequisitionStatus.PendingWarehouseCheck ? 1 :
                (r.Children.Any()
                    ? r.Children.All(c => TerminalStatuses.Contains(c.Status))
                    : TerminalStatuses.Contains(r.Status)) ? 3 : 2)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToListAsync();

        var paged = PagedResult<RequisitionResponseDto>.Create(items.Select(MapToResponse), totalCount, pagination);
        return ApiResult<PagedResult<RequisitionResponseDto>>.Success(paged);
    }

    public async Task<ApiResult<RequisitionResponseDto>> GetByIdAsync(Guid id)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<RequisitionResponseDto>.Failure([$"Requisition '{id}' topilmadi."], 404);

        return ApiResult<RequisitionResponseDto>.Success(MapToResponse(r));
    }

    public async Task<ApiResult<Guid>> CreateAsync(RequisitionCreateDto dto, Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(dto.RequisitionNo))
            return ApiResult<Guid>.Failure(["Talabnoma nomini kiriting."]);

        if (dto.Type == RequisitionType.Contract && dto.ContractId is null)
            return ApiResult<Guid>.Failure(["Shartnoma bo'yicha talabnomada ContractId majburiy."]);

        if (dto.Type == RequisitionType.Individual && dto.DepartmentId is null)
            return ApiResult<Guid>.Failure(["Individual talabnomada DepartmentId majburiy."]);

        if (dto.Items.Count == 0)
            return ApiResult<Guid>.Failure(["Kamida bitta material kerak."]);

        foreach (var item in dto.Items)
        {
            if (item.MaterialId is null && string.IsNullOrWhiteSpace(item.FreeTextName))
                return ApiResult<Guid>.Failure(["Har bir materialda MaterialId yoki nomi ko'rsatilishi shart."]);
        }

        var no = dto.RequisitionNo.Trim();
        var taken = await _context.Requisitions.AnyAsync(r => r.RequisitionNo == no);
        if (taken)
            return ApiResult<Guid>.Failure(["Bunday nomli talabnoma allaqachon mavjud."]);

        var requisition = new Requisition
        {
            Id = Guid.NewGuid(),
            RequisitionNo = no,
            Type = dto.Type,
            Status = RequisitionStatus.PendingWarehouseCheck,
            ContractId = dto.ContractId,
            DepartmentId = dto.DepartmentId,
            Purpose = dto.Purpose,
            Notes = dto.Notes,
            SignerName = dto.SignerName,
            SignerTitle = dto.SignerTitle,
            SignDate = dto.SignDate,
            CreatedBy = createdBy,
            Items = dto.Items.Select(i => new RequisitionItem
            {
                Id = Guid.NewGuid(),
                MaterialId = i.MaterialId,
                FreeTextName = i.FreeTextName,
                FreeTextUnit = i.FreeTextUnit,
                FreeTextSpec = i.FreeTextSpec,
                FreeTextPhoto = i.FreeTextPhoto,
                Quantity = i.Quantity,
                Notes = i.Notes
            }).ToList()
        };

        _context.Requisitions.Add(requisition);
        await _context.SaveChangesAsync();

        // Omborchilarga bildirishnoma
        await NotifyWarehouseCheckersAsync(requisition);

        return ApiResult<Guid>.Success(requisition.Id);
    }

    public async Task<ApiResult<List<Guid>>> WarehouseCheckAsync(Guid id, RequisitionWarehouseCheckDto dto, Guid checkerId)
    {
        var r = await _context.Requisitions
            .Include(x => x.Items).ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (r is null)
            return ApiResult<List<Guid>>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingWarehouseCheck)
            return ApiResult<List<Guid>>.Failure(["Faqat ombor tekshiruvini kutayotgan talabnomani tekshirish mumkin."]);

        var checker = await _context.Users.FindAsync(checkerId);
        if (checker is null)
            return ApiResult<List<Guid>>.Failure(["Omborchi topilmadi."], 404);

        var warehouseDept = await _context.Departments
            .FirstOrDefaultAsync(d => d.Type == DepartmentType.Omborxona && d.IsActive);
        if (warehouseDept is null)
            return ApiResult<List<Guid>>.Failure(["Omborxona bo'limi sozlanmagan."]);

        var checkMap = dto.Items.ToDictionary(i => i.ItemId);

        // Bitta talabnoma ichida bir xil mahsulot bir necha marta bo'lsa,
        // umumiy miqdorni bir Productdan kamaytirish uchun rezerv qo'shimchalarini yig'amiz.
        var reservationDelta = new Dictionary<Guid, decimal>();

        await using var tx = await _context.Database.BeginTransactionAsync();

        foreach (var item in r.Items)
        {
            if (!checkMap.TryGetValue(item.Id, out var check))
                return ApiResult<List<Guid>>.Failure([$"Item '{item.Id}' uchun tekshiruv natijasi yuborilmagan."]);

            if (check.AvailableQuantity < 0)
                return ApiResult<List<Guid>>.Failure(["Mavjud miqdor manfiy bo'lishi mumkin emas."]);

            if (check.AvailableQuantity > item.Quantity)
                return ApiResult<List<Guid>>.Failure([$"Mavjud miqdor so'ralgan miqdordan ({item.Quantity}) ko'p bo'lishi mumkin emas."]);

            item.AvailableQuantity = check.AvailableQuantity;
            item.WarehouseNotes = check.WarehouseNotes;

            if (check.AvailableQuantity > 0)
            {
                var productName = (item.Material?.Name ?? item.FreeTextName ?? string.Empty).Trim();
                if (productName.Length == 0) continue;

                var lower = productName.ToLower();
                var product = await _context.Products
                    .FirstOrDefaultAsync(p => p.DepartmentId == warehouseDept.Id && p.Name.ToLower() == lower);

                if (product is null) continue;

                var alreadyAdded = reservationDelta.TryGetValue(product.Id, out var prev) ? prev : 0m;
                var newDelta = alreadyAdded + check.AvailableQuantity;
                var effectiveFree = product.Quantity - product.ReservedQuantity - alreadyAdded;
                if (check.AvailableQuantity > effectiveFree)
                    return ApiResult<List<Guid>>.Failure([$"\"{product.Name}\" omborda yetarli emas (erkin: {effectiveFree}, kerak: {check.AvailableQuantity})."]);

                reservationDelta[product.Id] = newDelta;
                item.ReservedProductId = product.Id;
            }
        }

        foreach (var (productId, delta) in reservationDelta)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product is null) continue;
            product.ReservedQuantity += delta;
        }

        r.WarehouseCheckedBy = checkerId;
        r.WarehouseCheckedAt = DateTime.UtcNow;
        r.WarehouseCheckQrCodeData = GenerateWarehouseQrCode(r, checker);

        // Avto-bo'linish: omborchi tekshiruvi tugagach darrov 2 ta child yaratiladi
        var children = BuildChildren(r);

        if (children.Count == 0)
            return ApiResult<List<Guid>>.Failure(["Talabnomada bo'lish uchun item topilmadi."]);

        foreach (var c in children) _context.Requisitions.Add(c);
        r.Status = RequisitionStatus.Split;

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        // Yaratuvchiga xabar
        await _notificationService.CreateAsync(r.CreatedBy,
            $"Ombor tekshiruvi yakunlandi: {r.RequisitionNo}",
            $"Talabnomangiz tekshirildi va {children.Count} ta yo'nalishga bo'lindi.",
            NotificationType.Info);

        // Direktorlarga bildirishnoma
        await NotifyDirectorsAsync(r.RequisitionNo, children.Count);

        return ApiResult<List<Guid>>.Success(children.Select(c => c.Id).ToList());
    }

    public async Task<ApiResult<List<Guid>>> SplitAsync(Guid id, Guid currentUserId)
    {
        var parent = await _context.Requisitions
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (parent is null)
            return ApiResult<List<Guid>>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (parent.Status != RequisitionStatus.WarehouseChecked)
            return ApiResult<List<Guid>>.Failure(["Faqat ombor tekshiruvidan o'tgan talabnomani bo'lish mumkin."]);

        if (parent.CreatedBy != currentUserId)
            return ApiResult<List<Guid>>.Failure(["Faqat talabnoma yaratuvchisi uni bo'lib yuborishi mumkin."], 403);

        var children = BuildChildren(parent);

        if (children.Count == 0)
            return ApiResult<List<Guid>>.Failure(["Bo'lish uchun item topilmadi."]);

        foreach (var c in children) _context.Requisitions.Add(c);
        parent.Status = RequisitionStatus.Split;

        await _context.SaveChangesAsync();

        await NotifyDirectorsAsync(parent.RequisitionNo, children.Count);

        return ApiResult<List<Guid>>.Success(children.Select(c => c.Id).ToList());
    }

    private static List<Requisition> BuildChildren(Requisition parent)
    {
        var warehouseItems = new List<RequisitionItem>();
        var purchaseItems = new List<RequisitionItem>();

        foreach (var item in parent.Items)
        {
            var available = item.AvailableQuantity ?? 0m;
            var deficit = item.Quantity - available;

            if (available > 0)
            {
                warehouseItems.Add(new RequisitionItem
                {
                    Id = Guid.NewGuid(),
                    MaterialId = item.MaterialId,
                    FreeTextName = item.FreeTextName,
                    FreeTextUnit = item.FreeTextUnit,
                    FreeTextSpec = item.FreeTextSpec,
                    FreeTextPhoto = item.FreeTextPhoto,
                    Quantity = available,
                    OriginalQuantity = item.Quantity,
                    Notes = item.Notes,
                    ReservedProductId = item.ReservedProductId
                });
            }

            if (deficit > 0)
            {
                purchaseItems.Add(new RequisitionItem
                {
                    Id = Guid.NewGuid(),
                    MaterialId = item.MaterialId,
                    FreeTextName = item.FreeTextName,
                    FreeTextUnit = item.FreeTextUnit,
                    FreeTextSpec = item.FreeTextSpec,
                    FreeTextPhoto = item.FreeTextPhoto,
                    Quantity = deficit,
                    OriginalQuantity = item.Quantity,
                    Notes = item.Notes
                });
            }
        }

        var children = new List<Requisition>();

        if (warehouseItems.Count > 0)
        {
            children.Add(new Requisition
            {
                Id = Guid.NewGuid(),
                RequisitionNo = $"{parent.RequisitionNo}-W",
                Type = parent.Type,
                Status = RequisitionStatus.PendingApproval,
                ContractId = parent.ContractId,
                DepartmentId = parent.DepartmentId,
                Purpose = parent.Purpose,
                Notes = parent.Notes,
                SignerName = parent.SignerName,
                SignerTitle = parent.SignerTitle,
                SignDate = parent.SignDate,
                ParentRequisitionId = parent.Id,
                Source = RequisitionSource.Warehouse,
                CreatedBy = parent.CreatedBy,
                WarehouseCheckedBy = parent.WarehouseCheckedBy,
                WarehouseCheckedAt = parent.WarehouseCheckedAt,
                WarehouseCheckQrCodeData = parent.WarehouseCheckQrCodeData,
                Items = warehouseItems
            });
        }

        if (purchaseItems.Count > 0)
        {
            children.Add(new Requisition
            {
                Id = Guid.NewGuid(),
                RequisitionNo = $"{parent.RequisitionNo}-P",
                Type = parent.Type,
                Status = RequisitionStatus.PendingApproval,
                ContractId = parent.ContractId,
                DepartmentId = parent.DepartmentId,
                Purpose = parent.Purpose,
                Notes = parent.Notes,
                SignerName = parent.SignerName,
                SignerTitle = parent.SignerTitle,
                SignDate = parent.SignDate,
                ParentRequisitionId = parent.Id,
                Source = RequisitionSource.Purchase,
                CreatedBy = parent.CreatedBy,
                WarehouseCheckedBy = parent.WarehouseCheckedBy,
                WarehouseCheckedAt = parent.WarehouseCheckedAt,
                WarehouseCheckQrCodeData = parent.WarehouseCheckQrCodeData,
                Items = purchaseItems
            });
        }

        return children;
    }

    public async Task<ApiResult<bool>> ApproveAsync(Guid id, Guid directorId)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingApproval)
            return ApiResult<bool>.Failure(["Faqat tasdiqlash kutayotgan talabnomani tasdiqlash mumkin."]);

        if (r.Source is null)
            return ApiResult<bool>.Failure(["Talabnomada source aniqlanmagan."]);

        var director = await _context.Users.FindAsync(directorId);
        if (director is null)
            return ApiResult<bool>.Failure(["Direktor topilmadi."], 404);

        r.Status = r.Source == RequisitionSource.Warehouse
            ? RequisitionStatus.ReadyForWarehouseRelease
            : RequisitionStatus.ReadyForPurchase;
        r.ApprovedBy = directorId;
        r.ApprovedAt = DateTime.UtcNow;
        r.QrCodeData = GenerateQrCode(r, director);

        await _context.SaveChangesAsync();

        var sourceLabel = r.Source == RequisitionSource.Warehouse ? "ombordan olishga" : "sotib olishga";
        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma tasdiqlandi: {r.RequisitionNo}",
            $"Talabnomangiz tasdiqlandi va {sourceLabel} yo'naltirildi.",
            NotificationType.Info);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> RejectAsync(Guid id, Guid directorId, RequisitionRejectDto dto)
    {
        var r = await _context.Requisitions
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.PendingApproval)
            return ApiResult<bool>.Failure(["Faqat tasdiqlash kutayotgan talabnomani rad etish mumkin."]);

        // Warehouse manbali child rad etilsa, omborchi qo'ygan rezervlarni qaytarish
        if (r.Source == RequisitionSource.Warehouse)
        {
            foreach (var item in r.Items)
            {
                if (!item.ReservedProductId.HasValue) continue;
                var product = await _context.Products.FindAsync(item.ReservedProductId.Value);
                if (product is null) continue;
                product.ReservedQuantity = Math.Max(0m, product.ReservedQuantity - item.Quantity);
            }
        }

        r.Status = RequisitionStatus.Rejected;
        r.RejectionReason = dto.RejectionReason;
        r.ApprovedBy = directorId;
        r.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma rad etildi: {r.RequisitionNo}",
            $"Sabab: {dto.RejectionReason}",
            NotificationType.Warning);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> ReleaseAsync(Guid id, Guid releaserId)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.ReadyForWarehouseRelease)
            return ApiResult<bool>.Failure(["Faqat tasdiqlangan (ombordan olishga tayyor) talabnomani chiqarish mumkin."]);

        if (r.DepartmentId is null)
            return ApiResult<bool>.Failure(["Talabnoma bo'limga bog'lanmagan — qaysi bo'lim omboriga tushishi noma'lum."]);

        var targetDeptId = r.DepartmentId.Value;

        if (!await _context.Departments.AnyAsync(d => d.Id == targetDeptId))
            return ApiResult<bool>.Failure(["Maqsadli bo'lim topilmadi."]);

        // Mavjud Productlarni bir martada yuklab olish (upsert uchun)
        var existingProducts = await _context.Products
            .Where(p => p.DepartmentId == targetDeptId)
            .ToListAsync();

        // Korxona omborxonasidagi muzlatilgan Productlarni oldindan yuklab olish
        var reservedIds = r.Items.Where(i => i.ReservedProductId.HasValue)
            .Select(i => i.ReservedProductId!.Value).Distinct().ToList();
        var sourceProducts = reservedIds.Count > 0
            ? await _context.Products.Where(p => reservedIds.Contains(p.Id)).ToListAsync()
            : new List<Product>();
        var sourceProductMap = sourceProducts.ToDictionary(p => p.Id);

        await using var tx = await _context.Database.BeginTransactionAsync();

        var stockOutNoteBase = string.IsNullOrWhiteSpace(r.Purpose)
            ? $"Talabnoma: {r.RequisitionNo}"
            : $"Talabnoma: {r.RequisitionNo} — {r.Purpose}";

        var itemIndex = 0;
        foreach (var item in r.Items)
        {
            itemIndex++;
            var qty = item.Quantity;

            // Mahsulot nomi va birligi (MaterialId yoki erkin matn)
            string productName;
            ProductUnit unit;

            if (item.MaterialId.HasValue && item.Material is not null)
            {
                var material = item.Material;

                if (material.Quantity < qty)
                    return ApiResult<bool>.Failure([$"Omborda '{material.Name}' yetarli emas (mavjud: {material.Quantity}, kerak: {qty})."]);

                material.Quantity -= qty;
                material.UpdatedAt = DateTime.UtcNow;

                _context.StockOuts.Add(new StockOut
                {
                    Id = Guid.NewGuid(),
                    MaterialId = material.Id,
                    Quantity = qty,
                    DepartmentId = targetDeptId,
                    ContractId = r.ContractId,
                    IssuedBy = releaserId,
                    IssuedAt = DateTime.UtcNow,
                    Notes = stockOutNoteBase
                });

                productName = material.Name;
                unit = ParseProductUnit(material.Unit);
            }
            else
            {
                productName = item.FreeTextName ?? "Noma'lum mahsulot";
                unit = ParseProductUnit(item.FreeTextUnit);
            }

            // Korxona omborxonasidan ayirish: muzlatilgan Productni real chiqarish.
            // ReservedProductId belgilangan bo'lsa, manba Product ALBATTA topilishi shart —
            // aks holda hech narsadan zaxira yaratilgan bo'lar edi (phantom inventory):
            // bo'lim omboriga qo'shilardi-yu, hech qaysi manbadan ayrilmasdi. Manba
            // topilmasa (oraliqda o'chirilgan bo'lsa) butun chiqarishni bekor qilamiz.
            if (item.ReservedProductId.HasValue)
            {
                if (!sourceProductMap.TryGetValue(item.ReservedProductId.Value, out var source))
                    return ApiResult<bool>.Failure(
                        [$"'{productName}' uchun zaxiralangan ombor mahsuloti topilmadi (ehtimol o'chirilgan). " +
                         "Talabnomani qayta tekshiruvdan o'tkazing."]);

                if (source.Quantity < qty)
                    return ApiResult<bool>.Failure(
                        [$"Korxona omborxonasida '{source.Name}' yetarli emas (mavjud: {source.Quantity}, kerak: {qty})."]);

                source.Quantity -= qty;
                source.ReservedQuantity = Math.Max(0m, source.ReservedQuantity - qty);
            }

            // Bo'lim omboriga upsert
            var existing = existingProducts.FirstOrDefault(p =>
                p.Name.Equals(productName, StringComparison.OrdinalIgnoreCase) && p.Unit == unit);

            if (existing is not null)
            {
                existing.Quantity += qty;
            }
            else
            {
                var newProduct = new Product
                {
                    Id = Guid.NewGuid(),
                    Name = productName,
                    NameNormalized = TextNormalizer.Normalize(productName),
                    InvoiceNumber = $"{r.RequisitionNo}-{itemIndex:D2}",
                    Description = item.Notes,
                    Quantity = qty,
                    Unit = unit,
                    DepartmentId = targetDeptId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Products.Add(newProduct);
                existingProducts.Add(newProduct);
            }
        }

        r.Status = RequisitionStatus.Released;

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma chiqarib berildi: {r.RequisitionNo}",
            "Mahsulotlar bo'lim omboriga tushdi.",
            NotificationType.Info);

        return ApiResult<bool>.Success(true);
    }

    private static ProductUnit ParseProductUnit(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return ProductUnit.Dona;
        var s = raw.Trim().ToLowerInvariant();
        return s switch
        {
            "kg" or "kilogramm" or "kilo"            => ProductUnit.Kilogramm,
            "g" or "gr" or "gramm"                   => ProductUnit.Gramm,
            "l" or "lt" or "litr"                    => ProductUnit.Litr,
            "m" or "metr"                            => ProductUnit.Metr,
            "m2" or "kv.m" or "kvmetr" or "kv metr"  => ProductUnit.KvMetr,
            "m3" or "kub.m" or "kubmetr" or "kub metr" => ProductUnit.KubMetr,
            "quti" or "box"                          => ProductUnit.Quti,
            "paket" or "pak"                         => ProductUnit.Paket,
            "to'plam" or "toplam" or "set"           => ProductUnit.Toʻplam,
            _                                        => ProductUnit.Dona,
        };
    }

    // ─── Yordamchi metodlar ───────────────────────────────────────────────────

    private async Task<Requisition?> GetWithIncludes(Guid id) =>
        await _context.Requisitions
            .Include(r => r.Creator)
            .Include(r => r.Approver)
            .Include(r => r.WarehouseChecker)
            .Include(r => r.Contract)
            .Include(r => r.Department)
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .Include(r => r.Items).ThenInclude(i => i.Material)
            .FirstOrDefaultAsync(r => r.Id == id);

    private async System.Threading.Tasks.Task NotifyWarehouseCheckersAsync(Requisition r)
    {
        var checkers = await _context.Users
            .Include(u => u.Role).ThenInclude(role => role!.RolePermissions).ThenInclude(rp => rp.Permission)
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.WarehouseCheck))
            .ToListAsync();

        foreach (var checker in checkers)
        {
            await _notificationService.CreateAsync(checker.Id,
                $"Yangi talabnoma tekshiruvga: {r.RequisitionNo}",
                "Ombor tekshiruvini kutmoqda.",
                NotificationType.Info);
        }
    }

    private async System.Threading.Tasks.Task NotifyDirectorsAsync(string parentNo, int childCount)
    {
        var directors = await _context.Users
            .Include(u => u.Role).ThenInclude(role => role!.RolePermissions).ThenInclude(rp => rp.Permission)
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.Approve))
            .ToListAsync();

        foreach (var director in directors)
        {
            await _notificationService.CreateAsync(director.Id,
                $"Yangi tasdiqlash kerak: {parentNo}",
                $"{childCount} ta yangi talabnoma tasdiqlash kutmoqda.",
                NotificationType.Info);
        }
    }

    private static string GenerateQrCode(Requisition r, User director)
    {
        var directorFullName = $"{director.FirstName} {director.LastName}";
        var approvedAt = r.ApprovedAt?.ToString("yyyy-MM-ddTHH:mm:ss") ?? string.Empty;

        var raw = $"{r.Id}|{r.RequisitionNo}|{director.Id}|{approvedAt}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16];

        var payload = JsonSerializer.Serialize(new
        {
            id = r.Id,
            no = r.RequisitionNo,
            approvedBy = directorFullName,
            approvedAt,
            hash
        });

        return RenderQr(payload);
    }

    private static string GenerateWarehouseQrCode(Requisition r, User checker)
    {
        var checkerFullName = $"{checker.FirstName} {checker.LastName}";
        var checkedAt = r.WarehouseCheckedAt?.ToString("yyyy-MM-ddTHH:mm:ss") ?? string.Empty;

        var raw = $"WH|{r.Id}|{r.RequisitionNo}|{checker.Id}|{checkedAt}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16];

        var payload = JsonSerializer.Serialize(new
        {
            id = r.Id,
            no = r.RequisitionNo,
            checkedBy = checkerFullName,
            checkedAt,
            hash
        });

        return RenderQr(payload);
    }

    private static string RenderQr(string payload)
    {
        using var qrGenerator = new QRCodeGenerator();
        using var qrData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
        using var qrCode = new PngByteQRCode(qrData);
        var pngBytes = qrCode.GetGraphic(6);
        return Convert.ToBase64String(pngBytes);
    }

    private static string StatusLabel(RequisitionStatus s) => s switch
    {
        RequisitionStatus.Draft                    => "Qoralama",
        RequisitionStatus.PendingWarehouseCheck    => "Ombor tekshiruvida",
        RequisitionStatus.WarehouseChecked         => "Tekshiruv yakunlandi",
        RequisitionStatus.Split                    => "Bo'lib yuborilgan",
        RequisitionStatus.PendingApproval          => "Tasdiqlash kutilmoqda",
        RequisitionStatus.Rejected                 => "Rad etilgan",
        RequisitionStatus.ReadyForWarehouseRelease => "Ombordan olishga",
        RequisitionStatus.ReadyForPurchase         => "Sotib olishga",
        _                                          => s.ToString()
    };

    private static string SourceLabel(RequisitionSource s) => s switch
    {
        RequisitionSource.Warehouse => "Ombordan olinadigan",
        RequisitionSource.Purchase  => "Sotib olinadigan",
        _                           => s.ToString()
    };

    private static RequisitionResponseDto MapToResponse(Requisition r) => new()
    {
        Id = r.Id,
        RequisitionNo = r.RequisitionNo,
        Type = r.Type,
        TypeLabel = r.Type switch
        {
            RequisitionType.Contract   => "Shartnoma bo'yicha",
            RequisitionType.Individual => "Individual",
            _                          => r.Type.ToString()
        },
        Status = r.Status,
        StatusLabel = StatusLabel(r.Status),
        ContractId = r.ContractId,
        ContractNo = r.Contract?.ContractNo,
        DepartmentId = r.DepartmentId,
        DepartmentName = r.Department?.Name,
        Purpose = r.Purpose,
        Notes = r.Notes,
        RejectionReason = r.RejectionReason,
        SignerName = r.SignerName,
        SignerTitle = r.SignerTitle,
        SignDate = r.SignDate,
        ParentRequisitionId = r.ParentRequisitionId,
        ParentRequisitionNo = r.Parent?.RequisitionNo,
        Source = r.Source,
        SourceLabel = r.Source.HasValue ? SourceLabel(r.Source.Value) : null,
        Children = r.Children.Select(c => new RequisitionChildSummaryDto
        {
            Id = c.Id,
            RequisitionNo = c.RequisitionNo,
            Status = c.Status,
            StatusLabel = StatusLabel(c.Status),
            Source = c.Source ?? RequisitionSource.Warehouse,
            SourceLabel = c.Source.HasValue ? SourceLabel(c.Source.Value) : string.Empty,
            ItemCount = c.Items.Count
        }).ToList(),
        WarehouseCheckedBy = r.WarehouseCheckedBy,
        WarehouseCheckedByName = r.WarehouseChecker is null ? null : $"{r.WarehouseChecker.FirstName} {r.WarehouseChecker.LastName}",
        WarehouseCheckedAt = r.WarehouseCheckedAt,
        WarehouseCheckQrCodeData = r.WarehouseCheckQrCodeData,
        ApprovedBy = r.ApprovedBy,
        ApprovedByName = r.Approver is null ? null : $"{r.Approver.FirstName} {r.Approver.LastName}",
        ApprovedAt = r.ApprovedAt,
        QrCodeData = r.QrCodeData,
        CreatedBy = r.CreatedBy,
        CreatedByName = r.Creator is null ? string.Empty : $"{r.Creator.FirstName} {r.Creator.LastName}",
        CreatedAt = r.CreatedAt,
        Items = r.Items.Select(i => new RequisitionItemResponseDto
        {
            Id = i.Id,
            MaterialId = i.MaterialId,
            MaterialName = i.Material?.Name ?? i.FreeTextName ?? string.Empty,
            MaterialCode = i.Material?.Code ?? string.Empty,
            Unit = i.Material?.Unit ?? i.FreeTextUnit ?? string.Empty,
            FreeTextSpec = i.FreeTextSpec,
            FreeTextPhoto = i.FreeTextPhoto,
            Quantity = i.Quantity,
            Notes = i.Notes,
            AvailableQuantity = i.AvailableQuantity,
            WarehouseNotes = i.WarehouseNotes,
            OriginalQuantity = i.OriginalQuantity
        }).ToList()
    };
}
