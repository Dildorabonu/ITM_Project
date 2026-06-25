using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class TechnicalDrawingService : ITechnicalDrawingService
{
    private readonly DatabaseContext _context;
    private readonly IAttachmentService _attachmentService;
    private readonly INotificationService _notificationService;

    public TechnicalDrawingService(DatabaseContext context, IAttachmentService attachmentService, INotificationService notificationService)
    {
        _context = context;
        _attachmentService = attachmentService;
        _notificationService = notificationService;
    }

    public async Task<ApiResult<PagedResult<TechnicalDrawingRowDto>>> GetPagedAsync(
        Guid currentUserId,
        bool viewAll,
        PaginationParams pagination,
        string? search = null,
        DrawingStatus? status = null,
        bool? onlyMissing = null,
        bool? isActive = null)
    {
        var lower = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        // ── 1. Drawings ────────────────────────────────────────────────────
        var drawings = new List<TechnicalDrawing>();
        if (onlyMissing != true)
        {
            var drawingsQuery = _context.TechnicalDrawings
                .Include(d => d.Contract)
                .Include(d => d.ContractProduct)
                .Include(d => d.Creator)
                .AsNoTracking()
                .AsQueryable();

            if (!viewAll)
            {
                drawingsQuery = drawingsQuery.Where(d =>
                    _context.ContractUsers.Any(cu => cu.ContractId == d.ContractId && cu.UserId == currentUserId) ||
                    _context.ContractDepartments.Any(cd => cd.ContractId == d.ContractId &&
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                    (d.ContractProductId != null && (
                        _context.ContractProductUsers.Any(pu => pu.ContractProductId == d.ContractProductId && pu.UserId == currentUserId) ||
                        _context.ContractProductDepartments.Any(pd => pd.ContractProductId == d.ContractProductId &&
                            _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))
                    )));
            }

            if (status.HasValue)
                drawingsQuery = drawingsQuery.Where(d => d.Status == status.Value);

            if (isActive.HasValue)
                drawingsQuery = drawingsQuery.Where(d => d.IsActive == isActive.Value);

            if (lower != null)
            {
                drawingsQuery = drawingsQuery.Where(d =>
                    d.Contract!.ContractNo.ToLower().Contains(lower) ||
                    d.Title.ToLower().Contains(lower) ||
                    (d.ContractProduct != null && d.ContractProduct.ProductType.ToLower().Contains(lower)));
            }

            drawings = await drawingsQuery.ToListAsync();
        }

        // ── 2. Empty placeholder rows ──────────────────────────────────────
        // Only meaningful for active contracts; skipped when filtering by a real status.
        var emptyRows = new List<TechnicalDrawingEmptyRowDto>();
        var includeEmpty = (isActive != false) && (!status.HasValue || onlyMissing == true);
        if (includeEmpty)
        {
            var contractsQuery = _context.Contracts
                .Include(c => c.Products).ThenInclude(p => p.Stages)
                .Where(c => c.IsActive)
                .AsNoTracking()
                .AsQueryable();

            if (!viewAll)
            {
                contractsQuery = contractsQuery.Where(c =>
                    c.ContractUsers.Any(cu => cu.UserId == currentUserId) ||
                    c.Products.Any(p => p.ProductUsers.Any(pu => pu.UserId == currentUserId)) ||
                    c.ContractDepartments.Any(cd =>
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                    c.Products.Any(p => p.ProductDepartments.Any(pd =>
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))));
            }

            var contracts = await contractsQuery.ToListAsync();

            var contractIds = contracts.Select(c => c.Id).ToList();
            var existingDrawingKeys = await _context.TechnicalDrawings
                .Where(d => d.IsActive && contractIds.Contains(d.ContractId))
                .Select(d => new { d.ContractId, d.ContractProductId })
                .ToListAsync();

            foreach (var c in contracts)
            {
                var contractDrawings = existingDrawingKeys.Where(d => d.ContractId == c.Id).ToList();
                var usedProductIds = contractDrawings
                    .Where(d => d.ContractProductId.HasValue)
                    .Select(d => d.ContractProductId!.Value)
                    .ToHashSet();

                if (c.Products.Count > 0)
                {
                    foreach (var p in c.Products)
                    {
                        if (!usedProductIds.Contains(p.Id))
                        {
                            emptyRows.Add(new TechnicalDrawingEmptyRowDto
                            {
                                ContractId = c.Id,
                                ContractNo = c.ContractNo,
                                ProductId = p.Id,
                                ProductType = p.ProductType,
                                Quantity = p.Quantity,
                                Unit = p.Unit,
                                DrawingReachable = IsStageReachable(p.Stages, StageType.Drawing),
                            });
                        }
                    }
                }
                else if (contractDrawings.Count == 0)
                {
                    emptyRows.Add(new TechnicalDrawingEmptyRowDto
                    {
                        ContractId = c.Id,
                        ContractNo = c.ContractNo,
                        ProductId = null,
                        ProductType = null,
                        Quantity = null,
                        Unit = null,
                    });
                }
            }

            if (lower != null)
            {
                emptyRows = emptyRows.Where(e =>
                    e.ContractNo.ToLower().Contains(lower) ||
                    (e.ProductType != null && e.ProductType.ToLower().Contains(lower))
                ).ToList();
            }
        }

        // ── 3. Combine, sort, paginate ─────────────────────────────────────
        var rows = new List<TechnicalDrawingRowDto>();

        rows.AddRange(emptyRows.Select(e => new TechnicalDrawingRowDto
        {
            Kind = TechnicalDrawingRowKind.Empty,
            Empty = e,
        }));

        rows.AddRange(drawings.Select(d => new TechnicalDrawingRowDto
        {
            Kind = TechnicalDrawingRowKind.Drawing,
            Drawing = MapToResponse(d),
        }));

        // Empty first, then drafts, then everything else (newest first within each rank).
        rows = rows
            .OrderBy(r => r.Kind == TechnicalDrawingRowKind.Empty
                ? 0
                : r.Drawing!.Status == DrawingStatus.Draft ? 1 : 2)
            .ThenByDescending(r => r.Drawing?.CreatedAt ?? DateTime.MinValue)
            .ToList();

        var totalCount = rows.Count;
        var pageItems = rows
            .Skip((pagination.Page - 1) * pagination.PageSize)
            .Take(pagination.PageSize)
            .ToList();

        var paged = PagedResult<TechnicalDrawingRowDto>.Create(pageItems, totalCount, pagination);
        return ApiResult<PagedResult<TechnicalDrawingRowDto>>.Success(paged);
    }

    // Dinamik workflow gating: bosqich shu mahsulot uchun hozir ish uchun ochiqmi.
    // Bosqich qatorlari yo'q (eski ma'lumot) → har doim ochiq (legacy xulq-atvor).
    // Bosqich workflowda yo'q → ochiq emas. Aks holda joriy bosqichdan keyin
    // turgan bosqichlar hali ochilmagan hisoblanadi.
    private static bool IsStageReachable(ICollection<ContractProductStage> stages, StageType target)
    {
        var ordered = stages.OrderBy(s => s.OrderIndex).Select(s => s.StageType).ToList();
        if (ordered.Count == 0) return true;
        var idx = ordered.IndexOf(target);
        if (idx < 0) return false;
        var current = WorkflowEngine.CurrentStage(stages);
        var curIdx = current is not null ? ordered.IndexOf(current.Value) : ordered.Count;
        return curIdx >= idx;
    }

    public async Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == dto.ContractId);
        if (contract is null)
            return ApiResult<Guid>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."]);

        if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == dto.ContractId);
            if (!productOk)
                return ApiResult<Guid>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
        }

        var drawing = new TechnicalDrawing
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            Title = dto.Title,
            Notes = dto.Notes,
            Status = DrawingStatus.Draft,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.TechnicalDrawings.Add(drawing);
        await _context.SaveChangesAsync();

        var deptUserIds = await _context.Users
            .Where(u => u.IsActive && _context.ContractDepartments
                .Any(cd => cd.ContractId == dto.ContractId && cd.DepartmentId == u.DepartmentId))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            deptUserIds,
            $"Yangi texnik chizma yuklandi: {contract.ContractNo}",
            $"«{contract.ContractNo}» shartnomasi uchun «{drawing.Title}» texnik chizmasi yuklandi.",
            NotificationType.Info,
            contract.Id);

        return ApiResult<Guid>.Success(drawing.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, TechnicalDrawingUpdateDto dto)
    {
        var drawing = await _context.TechnicalDrawings.FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        if (drawing.Status == DrawingStatus.Approved)
            return ApiResult<int>.Failure(["Tasdiqlangan texnik chizmani tahrirlab bo'lmaydi."], 409);

        if (dto.Title is not null) drawing.Title = dto.Title;
        if (dto.Notes is not null) drawing.Notes = dto.Notes;

        if (dto.ClearContractProduct)
        {
            drawing.ContractProductId = null;
        }
        else if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == drawing.ContractId);
            if (!productOk)
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
            drawing.ContractProductId = dto.ContractProductId.Value;
        }

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> UpdateStatusAsync(Guid id, DrawingStatus status)
    {
        var drawing = await _context.TechnicalDrawings
            .Include(d => d.Contract)
            .FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        drawing.Status = status;
        await _context.SaveChangesAsync();

        // Approving a drawing may complete the Drawing stage and advance the
        // affected product(s) to the next stage in their workflow.
        var contractMoved = false;
        if (status == DrawingStatus.Approved && drawing.Contract is not null)
        {
            var prevStatus = drawing.Contract.Status;
            await WorkflowEngine.RecomputeContractAsync(_context, drawing.ContractId);
            await _context.SaveChangesAsync();
            contractMoved = drawing.Contract.Status != prevStatus;
        }

        if (drawing.Contract is not null)
        {
            var contractId = drawing.Contract.Id;
            var contractNo = drawing.Contract.ContractNo;

            var deptUserIds = await _context.Users
                .Where(u => u.IsActive && _context.ContractDepartments
                    .Any(cd => cd.ContractId == contractId && cd.DepartmentId == u.DepartmentId))
                .Select(u => u.Id)
                .ToListAsync();

            var contractUserIds = await _context.ContractUsers
                .Where(cu => cu.ContractId == contractId)
                .Select(cu => cu.UserId)
                .ToListAsync();

            var allUserIds = deptUserIds.Union(contractUserIds).Distinct();

            if (status == DrawingStatus.Approved)
            {
                var body = contractMoved
                    ? $"«{contractNo}» shartnomasi texnik chizmasi tasdiqlandi. Shartnoma holati «Tex jarayon tayyorlanmoqda» ga o'zgardi."
                    : $"«{contractNo}» shartnomasi uchun «{drawing.Title}» texnik chizmasi tasdiqlandi.";
                await _notificationService.NotifyUsersAndSuperAdminsAsync(
                    allUserIds, $"Texnik chizma tasdiqlandi: {contractNo}", body, NotificationType.Task, contractId);
            }
        }

        return ApiResult<int>.Success(200);
    }

    private static TechnicalDrawingResponseDto MapToResponse(TechnicalDrawing d) => new()
    {
        Id = d.Id,
        ContractId = d.ContractId,
        ContractNo = d.Contract?.ContractNo ?? "",
        ContractProductId = d.ContractProductId,
        ProductType = d.ContractProduct?.ProductType,
        Title = d.Title,
        Notes = d.Notes,
        Status = d.Status,
        CreatedByFullName = d.Creator is not null ? $"{d.Creator.FirstName} {d.Creator.LastName}" : null,
        CreatedAt = d.CreatedAt,
        IsActive = d.IsActive,
    };
}
