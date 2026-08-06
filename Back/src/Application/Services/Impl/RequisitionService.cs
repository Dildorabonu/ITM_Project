using Application.DTOs;
using Application.DTOs.Requisitions;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Application.Services.Impl;

public class RequisitionService : IRequisitionService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IQrCodeService _qrCodeService;

    public RequisitionService(DatabaseContext context, INotificationService notificationService, IQrCodeService qrCodeService)
    {
        _context = context;
        _notificationService = notificationService;
        _qrCodeService = qrCodeService;
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

    // Sidebar badge har 30 soniyada so'raydi — shuning uchun Include'siz, faqat COUNT.
    // Filtr GetAllAsync bilan bir xil: badge raqami ombor tekshiruvi sahifasidagi
    // qatorlar soniga aynan mos tushishi kerak.
    public async Task<ApiResult<int>> GetPendingWarehouseCheckCountAsync(Guid currentUserId, bool viewAll)
    {
        var query = _context.Requisitions
            .AsNoTracking()
            .Where(r => r.Status == RequisitionStatus.PendingWarehouseCheck);

        if (!viewAll)
            query = query.Where(r => r.CreatedBy == currentUserId);

        return ApiResult<int>.Success(await query.CountAsync());
    }

    // Talabnoma "yakunlangan" hisoblanadigan holatlar: direktor qarori chiqarilgan
    // (tasdiq yoki rad) — undan keyingi ombor harakatlari holatni o'zgartirmaydi.
    // Frontenddagi TERMINAL_STATUSES (client/app/(documents)/requisitions/_types.ts)
    // bilan aynan bir xil bo'lishi shart — aks holda badge "Yakunlangan" deb
    // ko'rsatgan qator "Yakunlangan" filtriga tushmaydi.
    private static readonly RequisitionStatus[] TerminalStatuses =
    [
        RequisitionStatus.ReadyForWarehouseRelease,
        RequisitionStatus.ReadyForPurchase,
        RequisitionStatus.Released,
        RequisitionStatus.Delivered,
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
        if (dto.Type == RequisitionType.Contract && dto.ContractId is null)
            return ApiResult<Guid>.Failure(["Shartnoma bo'yicha talabnomada ContractId majburiy."]);

        // DepartmentId har ikkala tipda ham majburiy — busiz chiqarish bosqichida
        // mahsulot qaysi bo'lim omboriga tushishi noma'lum bo'lib qoladi.
        if (dto.DepartmentId is null)
            return ApiResult<Guid>.Failure(["Talabnomada DepartmentId majburiy."]);

        if (dto.Items.Count == 0)
            return ApiResult<Guid>.Failure(["Kamida bitta material kerak."]);

        foreach (var item in dto.Items)
        {
            if (item.MaterialId is null && string.IsNullOrWhiteSpace(item.FreeTextName))
                return ApiResult<Guid>.Failure(["Har bir materialda MaterialId yoki nomi ko'rsatilishi shart."]);
        }

        // Talabnomani faqat o'sha bo'lim xodimi yaratadi: bo'limga biriktirilmagan
        // foydalanuvchi (jumladan superadmin) yarata olmaydi, bo'lim ko'rsatilgan
        // bo'lsa u yaratuvchining o'z bo'limi bo'lishi shart.
        var creator = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == createdBy);
        if (creator is null)
            return ApiResult<Guid>.Failure(["Foydalanuvchi topilmadi."], 404);
        if (creator.DepartmentId is null)
            return ApiResult<Guid>.Failure(["Talabnoma yaratish uchun bo'limga biriktirilgan bo'lishingiz kerak."]);
        if (dto.DepartmentId.HasValue && dto.DepartmentId.Value != creator.DepartmentId.Value)
            return ApiResult<Guid>.Failure(["Talabnomani faqat o'z bo'limingiz uchun yaratishingiz mumkin."]);

        // Shartnoma tipida materiallar erkin kiritilmaydi — jadval shartnomaning
        // me'yoriy sarfidan to'ldirilgan bo'lishi shart (nomi, birligi, miqdori
        // va qatorlar to'plami me'yorga aynan mos kelishi tekshiriladi).
        if (dto.Type == RequisitionType.Contract)
        {
            var normError = await ValidateItemsAgainstCostNormAsync(dto, creator.DepartmentId.Value);
            if (normError is not null)
                return ApiResult<Guid>.Failure([normError]);
        }

        // Nomni foydalanuvchi kiritadi (blankda manba hujjatdan oldindan to'ldirilgan
        // bo'ladi, lekin tahrirlansa bo'ladi — kirill/rus yozuvi shu yerdan keladi).
        // Bo'sh kelsa nom manba hujjatdan yasaladi. Ikkala holatda ham nom band bo'lsa
        // xato qaytarilmaydi — oxiriga tartib raqami qo'shiladi.
        var no = dto.RequisitionNo.Trim();
        if (no.Length == 0)
            no = await BuildRequisitionNoBaseAsync(dto);
        no = await EnsureUniqueRequisitionNoAsync(no);

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

    // RequisitionNo ustuni uzunligi (RequisitionConfiguration bilan bir xil).
    private const int RequisitionNoMaxLength = 200;
    // Takrorlanish qo'shimchasi (" (12)") va bola talabnoma suffiksi ("-W"/"-P")
    // uchun qoldiriladigan zaxira.
    private const int RequisitionNoSuffixReserve = 10;

    // Nom bo'sh yuborilganda manba hujjatdan zaxira nom yasaladi: shartnoma tipida
    // "<ShartnomaNo> shartnoma talabnomasi", individualda "<Bo'lim> bo'lim talabnomasi".
    // Odatda nomni frontend to'ldirib yuboradi (foydalanuvchi tahrirlashi mumkin) —
    // bu metod eski integratsiyalar va bo'sh forma uchun.
    private async Task<string> BuildRequisitionNoBaseAsync(RequisitionCreateDto dto)
    {
        if (dto.Type == RequisitionType.Contract && dto.ContractId is not null)
        {
            var contractNo = await _context.Contracts
                .AsNoTracking()
                .Where(c => c.Id == dto.ContractId.Value)
                .Select(c => c.ContractNo)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(contractNo))
                return $"{contractNo.Trim()} shartnoma talabnomasi";
        }
        else if (dto.DepartmentId is not null)
        {
            var deptName = await _context.Departments
                .AsNoTracking()
                .Where(d => d.Id == dto.DepartmentId.Value)
                .Select(d => d.Name)
                .FirstOrDefaultAsync();
            if (!string.IsNullOrWhiteSpace(deptName))
                return $"{deptName.Trim()} bo'lim talabnomasi";
        }

        return "Talabnoma";
    }

    // Nomni ustun uzunligiga sig'diradi va band bo'lsa oxiriga " (2)", " (3)" …
    // tartib raqamini qo'shadi. Bitta shartnoma bo'yicha bir nechta talabnoma odatiy
    // hol, shuning uchun takrorlanish xato emas — nom jimgina raqamlanadi. Qo'lda
    // kiritilgan nom ham shu yerdan o'tadi.
    private async Task<string> EnsureUniqueRequisitionNoAsync(string baseName)
    {
        var maxBase = RequisitionNoMaxLength - RequisitionNoSuffixReserve;
        if (baseName.Length > maxBase)
            baseName = baseName[..maxBase].TrimEnd();

        // Shu nom bilan boshlanadigan barcha yozuvlar bir so'rovda olinadi —
        // har urinish uchun alohida so'rov yubormaslik uchun.
        var used = await _context.Requisitions
            .AsNoTracking()
            .Where(r => r.RequisitionNo.StartsWith(baseName))
            .Select(r => r.RequisitionNo)
            .ToListAsync();

        if (used.Count == 0)
            return baseName;

        var taken = used.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var candidate = baseName;
        for (var i = 2; taken.Contains(candidate); i++)
            candidate = $"{baseName} ({i})";

        return candidate;
    }

    // Shartnoma tipidagi talabnoma materiallarini shartnomaning me'yoriy sarflari
    // bilan solishtiradi. Kamida bitta me'yorga to'liq mos kelsa null (xatosiz),
    // aks holda xato matni qaytadi. Frontend "Me'yoriy sarfdan to'ldirish" bilan
    // bir xil mantiq: section bo'lmagan, nomi bor qatorlar; bo'limlar biriktirilgan
    // me'yorda faqat yaratuvchi bo'limining qatorlari; miqdor = TotalQty × mahsulot soni.
    private async Task<string?> ValidateItemsAgainstCostNormAsync(RequisitionCreateDto dto, Guid creatorDeptId)
    {
        var norms = await _context.CostNorms
            .Include(n => n.ContractProduct)
            .Include(n => n.Items)
            .AsNoTracking()
            .Where(n => n.ContractId == dto.ContractId!.Value)
            .ToListAsync();

        if (norms.Count == 0)
            return "Bu shartnoma uchun me'yoriy sarf topilmadi — shartnoma tipidagi talabnoma faqat me'yoriy sarf asosida yaratiladi.";

        if (norms.Any(n => MatchesNorm(n, dto.Items, creatorDeptId)))
            return null;

        return "Talabnoma materiallari shartnoma me'yoriy sarfiga mos emas — materiallar me'yoriy sarfdan o'zgartirilmasdan olinishi kerak.";
    }

    private static bool MatchesNorm(CostNorm norm, List<RequisitionItemCreateDto> items, Guid creatorDeptId)
    {
        // Frontend row.name = name ?? no bo'yicha to'ldiradi va bo'sh nomli qatorlarni
        // saqlamaydi — shuning uchun shu ko'rinishda bo'sh bo'lmagan qatorlargina olinadi.
        var lines = norm.Items
            .Where(i => !i.IsSection && !string.IsNullOrWhiteSpace(i.Name ?? i.No))
            .ToList();

        if (lines.Any(l => l.DepartmentId != null))
            lines = lines.Where(l => l.DepartmentId == creatorDeptId).ToList();

        if (lines.Count == 0 || lines.Count != items.Count)
            return false;

        var contractQty = norm.ContractProduct?.Quantity > 0 ? norm.ContractProduct.Quantity : 1;
        var pool = new List<CostNormItem>(lines);
        foreach (var item in items)
        {
            var idx = pool.FindIndex(l => LineMatchesItem(l, item, contractQty));
            if (idx < 0) return false;
            pool.RemoveAt(idx);
        }
        return true;
    }

    private static bool LineMatchesItem(CostNormItem line, RequisitionItemCreateDto item, int contractQty)
    {
        var lineName = (line.Name ?? line.No ?? "").Trim();
        var itemName = (item.FreeTextName ?? "").Trim();
        if (!string.Equals(lineName, itemName, StringComparison.OrdinalIgnoreCase))
            return false;

        var lineUnit = (line.Unit ?? "").Trim();
        var itemUnit = (item.FreeTextUnit ?? "").Trim();
        if (!string.Equals(lineUnit, itemUnit, StringComparison.OrdinalIgnoreCase))
            return false;

        // TotalQty bo'sh yoki o'qib bo'lmas bo'lsa miqdor tekshirilmaydi (frontend
        // bunday qatorga default 1 yuboradi). Float hisob-kitob farqlari uchun
        // kichik tolerans qoldiriladi.
        if (!string.IsNullOrWhiteSpace(line.TotalQty)
            && decimal.TryParse(line.TotalQty.Trim().Replace(",", "."),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var totalQty))
        {
            var expected = totalQty * contractQty;
            var tolerance = 0.01m + Math.Abs(expected) * 0.0001m;
            if (Math.Abs(item.Quantity - expected) > tolerance)
                return false;
        }
        return true;
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

        // Ombor mahsulotlari bitta so'rovda oldindan olinadi. Ilgari har bir item
        // uchun alohida SELECT ketardi — 30 qatorli talabnomada 30 ta ketma-ket
        // aylanma, ya'ni tekshiruvni yakunlash sezilarli sekinlashardi.
        var neededNames = new HashSet<string>();
        foreach (var item in r.Items)
        {
            if (!checkMap.TryGetValue(item.Id, out var c) || c.AvailableQuantity <= 0) continue;
            var name = (item.Material?.Name ?? item.FreeTextName ?? string.Empty).Trim().ToLower();
            if (name.Length > 0) neededNames.Add(name);
        }

        var productByName = new Dictionary<string, Product>();
        if (neededNames.Count > 0)
        {
            var nameList = neededNames.ToList();
            var warehouseProducts = await _context.Products
                .Where(p => p.DepartmentId == warehouseDept.Id && nameList.Contains(p.Name.ToLower()))
                .ToListAsync();

            foreach (var p in warehouseProducts)
                productByName.TryAdd(p.Name.ToLower(), p);
        }

        foreach (var item in r.Items)
        {
            if (!checkMap.TryGetValue(item.Id, out var check))
                return ApiResult<List<Guid>>.Failure([$"Item '{item.Id}' uchun tekshiruv natijasi yuborilmagan."]);

            if (check.AvailableQuantity < 0)
                return ApiResult<List<Guid>>.Failure(["Mavjud miqdor manfiy bo'lishi mumkin emas."]);

            // Eski yozuvlarda so'ralgan miqdor klientdagi float xatosi bilan
            // saqlangan bo'lishi mumkin (53.99999999999999). Saqlangan qiymat
            // o'zgartirilmaydi — faqat taqqoslashda juda kichik tolerans beriladi,
            // aks holda omborchi 54 ni kiritganda talabnoma bekorga rad etiladi.
            var availableQty = check.AvailableQuantity;
            var tolerance = 0.0000001m + Math.Abs(item.Quantity) * 0.0000000001m;
            if (availableQty - item.Quantity > tolerance)
                return ApiResult<List<Guid>>.Failure([$"Mavjud miqdor so'ralgan miqdordan ({item.Quantity}) ko'p bo'lishi mumkin emas."]);

            item.AvailableQuantity = availableQty;
            item.WarehouseNotes = check.WarehouseNotes;

            if (availableQty > 0)
            {
                var productName = (item.Material?.Name ?? item.FreeTextName ?? string.Empty).Trim();
                if (productName.Length == 0) continue;

                if (!productByName.TryGetValue(productName.ToLower(), out var product)) continue;

                var alreadyAdded = reservationDelta.TryGetValue(product.Id, out var prev) ? prev : 0m;
                var newDelta = alreadyAdded + availableQty;
                var effectiveFree = product.Quantity - product.ReservedQuantity - alreadyAdded;
                if (availableQty > effectiveFree)
                    return ApiResult<List<Guid>>.Failure([$"\"{product.Name}\" omborda yetarli emas (erkin: {effectiveFree}, kerak: {availableQty})."]);

                reservationDelta[product.Id] = newDelta;
                item.ReservedProductId = product.Id;
            }
        }

        foreach (var (productId, delta) in reservationDelta)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product is null) continue;
            product.ReservedQuantity += delta;

            // Ledger: ombor tekshiruvida markaziy ombor mahsuloti rezervga olindi
            AddMovement(StockMovementType.Reserve, product, delta, null,
                null, warehouseDept.Id, r.Id, r.ContractId, checkerId,
                $"Ombor tekshiruvi: {r.RequisitionNo}");
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

    private static List<Requisition> BuildChildren(Requisition parent)
    {
        var warehouseItems = new List<RequisitionItem>();
        var purchaseItems = new List<RequisitionItem>();

        foreach (var item in parent.Items)
        {
            var requestedQty = item.Quantity;
            var available = item.AvailableQuantity ?? 0m;
            // decimal ayirmasi aniq — yaxlitlash kerak emas.
            var deficit = requestedQty - available;

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
                    OriginalQuantity = requestedQty,
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
                    OriginalQuantity = requestedQty,
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

        // Shu chiqarishda yaratiladigan yangi Productlarga noyob QR kod tayinlash uchun
        // (SaveChanges'gacha DB ko'rmaydigan kodlarni ham hisobga olamiz).
        var assignedQrCodes = new HashSet<string>();

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
            Product? releasedSource = null;
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
                releasedSource = source;
            }

            // Bo'lim omboriga upsert: katalog itemlar MaterialId bo'yicha,
            // FreeText itemlar normalize(nom) + birlik bo'yicha.
            var normalized = TextNormalizer.Normalize(productName);
            var existing = item.MaterialId.HasValue
                ? existingProducts.FirstOrDefault(p => p.MaterialId == item.MaterialId.Value)
                : existingProducts.FirstOrDefault(p => p.NameNormalized == normalized && p.Unit == unit);

            Product targetProduct;
            if (existing is not null)
            {
                existing.Quantity += qty;
                targetProduct = existing;
            }
            else
            {
                var newProduct = new Product
                {
                    Id = Guid.NewGuid(),
                    Name = productName,
                    NameNormalized = normalized,
                    InvoiceNumber = $"{r.RequisitionNo}-{itemIndex:D2}",
                    QrCode = await ProductCodeGenerator.NewUniqueAsync(_context, assignedQrCodes),
                    Description = item.Notes,
                    Quantity = qty,
                    Unit = unit,
                    DepartmentId = targetDeptId,
                    MaterialId = item.MaterialId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Products.Add(newProduct);
                existingProducts.Add(newProduct);
                targetProduct = newProduct;
            }

            // Ledger: markaziy ombordan bo'lim omboriga ko'chirish (+ rezervni bo'shatish)
            var sourceDeptId = releasedSource?.DepartmentId;
            AddMovement(StockMovementType.Transfer, targetProduct, qty, item.MaterialId,
                sourceDeptId, targetDeptId, r.Id, r.ContractId, releaserId, stockOutNoteBase);
            if (releasedSource is not null)
                AddMovement(StockMovementType.Release, releasedSource, qty, item.MaterialId,
                    sourceDeptId, targetDeptId, r.Id, r.ContractId, releaserId, stockOutNoteBase);
        }

        // Xarid orqali kelgan tovar omborxonadan tranzit qildi → Delivered;
        // oddiy ombor qoldig'idan berilgani esa avvalgidek Released.
        r.Status = r.Source == RequisitionSource.Purchase
            ? RequisitionStatus.Delivered
            : RequisitionStatus.Released;

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Talabnoma chiqarib berildi: {r.RequisitionNo}",
            "Mahsulotlar bo'lim omboriga tushdi.",
            NotificationType.Info);

        return ApiResult<bool>.Success(true);
    }

    public async Task<ApiResult<bool>> ReceivePurchaseAsync(Guid id, Guid receiverId)
    {
        var r = await GetWithIncludes(id);
        if (r is null)
            return ApiResult<bool>.Failure([$"Requisition '{id}' topilmadi."], 404);

        if (r.Status != RequisitionStatus.ReadyForPurchase || r.Source != RequisitionSource.Purchase)
            return ApiResult<bool>.Failure(["Faqat sotib olishga tasdiqlangan (xarid) talabnomani omborga qabul qilish mumkin."]);

        var warehouseDept = await _context.Departments
            .FirstOrDefaultAsync(d => d.Type == DepartmentType.Omborxona && d.IsActive);
        if (warehouseDept is null)
            return ApiResult<bool>.Failure(["Omborxona bo'limi sozlanmagan."]);

        // Markaziy ombordagi mavjud Productlarni upsert uchun oldindan yuklab olish
        var warehouseProducts = await _context.Products
            .Where(p => p.DepartmentId == warehouseDept.Id)
            .ToListAsync();

        var noteBase = string.IsNullOrWhiteSpace(r.Purpose)
            ? $"Xarid: {r.RequisitionNo}"
            : $"Xarid: {r.RequisitionNo} — {r.Purpose}";

        // Shu qabulda yaratiladigan yangi Productlarga noyob QR kod tayinlash uchun.
        var assignedQrCodes = new HashSet<string>();

        await using var tx = await _context.Database.BeginTransactionAsync();

        var itemIndex = 0;
        foreach (var item in r.Items)
        {
            itemIndex++;
            var qty = item.Quantity;

            string productName;
            ProductUnit unit;

            if (item.MaterialId.HasValue && item.Material is not null)
            {
                var material = item.Material;
                productName = material.Name;
                unit = ParseProductUnit(material.Unit);

                // Material katalogiga kirim + audit yozuvi (faqat Material-asosli itemlar)
                material.Quantity += qty;
                material.UpdatedAt = DateTime.UtcNow;

                _context.StockIns.Add(new StockIn
                {
                    Id = Guid.NewGuid(),
                    MaterialId = material.Id,
                    Quantity = qty,
                    ContractId = r.ContractId,
                    ReceivedBy = receiverId,
                    ReceivedAt = DateTime.UtcNow,
                    Notes = noteBase
                });
            }
            else
            {
                productName = item.FreeTextName ?? "Noma'lum mahsulot";
                unit = ParseProductUnit(item.FreeTextUnit);
            }

            // Markaziy ombor Productiga upsert: katalog itemlar MaterialId bo'yicha
            // (string-match drift yo'q), FreeText itemlar normalize(nom) + birlik bo'yicha.
            var normalized = TextNormalizer.Normalize(productName);
            var existing = item.MaterialId.HasValue
                ? warehouseProducts.FirstOrDefault(p => p.MaterialId == item.MaterialId.Value)
                : warehouseProducts.FirstOrDefault(p => p.NameNormalized == normalized && p.Unit == unit);

            // (Name, DepartmentId, Unit) DB unikal cheklovi NameNormalized/MaterialId
            // kalitlaridan farq qiladi. Mavjud mahsulot boshqa yo'l bilan yaratilgan
            // bo'lsa (NameNormalized bo'sh yoki MaterialId farqlansa), aniq nom + birlik
            // bo'yicha ham qidiramiz — aks holda xuddi shu (nom, birlik) li yangi yozuv
            // IX_Products_Name_DepartmentId_Unit duplicate key xatosini keltirib chiqaradi.
            existing ??= warehouseProducts.FirstOrDefault(p => p.Name == productName && p.Unit == unit);

            // (Name, DepartmentId) DB unikal cheklovi yuqoridagi kalitlardan torroq:
            // bir xil nomli mahsulot bo'lsa, MaterialId/Unit farqlansa ham unga birlashtiramiz —
            // aks holda IX_Products_Name_DepartmentId duplicate key xatosi tushadi.
            existing ??= warehouseProducts.FirstOrDefault(p => p.Name == productName);

            Product target;
            if (existing is not null)
            {
                existing.Quantity += qty;
                target = existing;
            }
            else
            {
                target = new Product
                {
                    Id = Guid.NewGuid(),
                    Name = productName,
                    NameNormalized = normalized,
                    InvoiceNumber = $"{r.RequisitionNo}-{itemIndex:D2}",
                    QrCode = await ProductCodeGenerator.NewUniqueAsync(_context, assignedQrCodes),
                    Description = item.Notes,
                    Quantity = qty,
                    Unit = unit,
                    DepartmentId = warehouseDept.Id,
                    MaterialId = item.MaterialId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Products.Add(target);
                warehouseProducts.Add(target);
            }

            // Shu talabnomaga band qilib qo'yamiz — Release keyin ayiradi
            target.ReservedQuantity += qty;
            item.ReservedProductId = target.Id;

            // Ledger: omborga kirim + rezerv (FreeText itemlar ham shu yerda iz qoldiradi)
            AddMovement(StockMovementType.In, target, qty, item.MaterialId,
                null, warehouseDept.Id, r.Id, r.ContractId, receiverId, noteBase);
            AddMovement(StockMovementType.Reserve, target, qty, item.MaterialId,
                null, warehouseDept.Id, r.Id, r.ContractId, receiverId, noteBase);
        }

        // Endi ombordan berishga tayyor: mavjud Release oqimiga qo'shiladi
        r.Status = RequisitionStatus.ReadyForWarehouseRelease;

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        await _notificationService.CreateAsync(r.CreatedBy,
            $"Xarid omborga qabul qilindi: {r.RequisitionNo}",
            "Sotib olingan mahsulotlar omborxonaga kirdi va bo'limga berishga tayyor.",
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

    // Ombor harakatlari jurnaliga (StockMovement) bitta qator qo'shadi.
    // QuantityAfter aniq bo'lishi uchun shu mahsulot miqdori o'zgargandan KEYIN,
    // o'sha tranzaksiya ichida chaqirilishi shart. qty har doim musbat beriladi.
    private void AddMovement(StockMovementType type, Product product, decimal qty,
        Guid? materialId, Guid? sourceDeptId, Guid? targetDeptId,
        Guid? requisitionId, Guid? contractId, Guid userId, string? notes)
    {
        _context.StockMovements.Add(new StockMovement
        {
            Id = Guid.NewGuid(),
            Type = type,
            ProductId = product.Id,
            MaterialId = materialId,
            SourceDepartmentId = sourceDeptId,
            TargetDepartmentId = targetDeptId,
            Quantity = qty,
            QuantityAfter = product.Quantity,
            RequisitionId = requisitionId,
            ContractId = contractId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            Notes = notes
        });
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

    // Faqat Id lar kerak — Include bilan Role/RolePermissions/Permission
    // grafini butunlay materializatsiya qilish o'rniga Select(u => u.Id) bilan
    // bitta yengil so'rov qilamiz. Bildirishnomalar ham tsiklda emas, bitta
    // NotifyManyAsync (bitta SaveChanges) bilan yoziladi.
    private async System.Threading.Tasks.Task NotifyWarehouseCheckersAsync(Requisition r)
    {
        var checkerIds = await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.WarehouseCheck))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyManyAsync(checkerIds,
            $"Yangi talabnoma tekshiruvga: {r.RequisitionNo}",
            "Ombor tekshiruvini kutmoqda.",
            NotificationType.Info);
    }

    private async System.Threading.Tasks.Task NotifyDirectorsAsync(string parentNo, int childCount)
    {
        var directorIds = await _context.Users
            .AsNoTracking()
            .Where(u => u.IsActive && u.Role != null
                && u.Role.RolePermissions.Any(rp =>
                    rp.Permission.Module == PermissionModule.Requisitions
                    && rp.Permission.Action == PermissionAction.Approve))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyManyAsync(directorIds,
            $"Yangi tasdiqlash kerak: {parentNo}",
            $"{childCount} ta yangi talabnoma tasdiqlash kutmoqda.",
            NotificationType.Info);
    }

    private string GenerateQrCode(Requisition r, User director)
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

        return _qrCodeService.RenderPngBase64(payload);
    }

    private string GenerateWarehouseQrCode(Requisition r, User checker)
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

        return _qrCodeService.RenderPngBase64(payload);
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
        RequisitionStatus.Released                 => "Chiqarib berildi",
        RequisitionStatus.Delivered                => "Xarid yetkazildi",
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
        WarehouseCheckedByName = r.WarehouseChecker is null ? null : $"{r.WarehouseChecker.FirstName} {r.WarehouseChecker.LastName}",
        WarehouseCheckedAt = r.WarehouseCheckedAt,
        WarehouseCheckQrCodeData = r.WarehouseCheckQrCodeData,
        ApprovedByName = r.Approver is null ? null : $"{r.Approver.FirstName} {r.Approver.LastName}",
        ApprovedAt = r.ApprovedAt,
        QrCodeData = r.QrCodeData,
        CreatedByName = r.Creator is null ? string.Empty : $"{r.Creator.FirstName} {r.Creator.LastName}",
        CreatedAt = r.CreatedAt,
        Items = r.Items.Select(i => new RequisitionItemResponseDto
        {
            Id = i.Id,
            MaterialName = i.Material?.Name ?? i.FreeTextName ?? string.Empty,
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
