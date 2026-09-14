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
    private readonly INotificationService _notificationService;

    public TechnicalDrawingService(DatabaseContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    // The grid is one list built from three independently ordered segments:
    // empty placeholders first, then drafts, then everything else. Counting the
    // segments up front lets every page slice be read straight from the database
    // instead of materialising the whole table on each request.
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

        // ── 1. Drawing segments ────────────────────────────────────────────
        var draftCount = 0;
        var otherCount = 0;
        IQueryable<TechnicalDrawing>? drawingsQuery = null;

        if (onlyMissing != true)
        {
            drawingsQuery = _context.TechnicalDrawings.AsNoTracking();

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

            var buckets = await drawingsQuery
                .GroupBy(d => d.Status == DrawingStatus.Draft)
                .Select(g => new { IsDraft = g.Key, Count = g.Count() })
                .ToListAsync();

            draftCount = buckets.FirstOrDefault(b => b.IsDraft)?.Count ?? 0;
            otherCount = buckets.FirstOrDefault(b => !b.IsDraft)?.Count ?? 0;
        }

        // ── 2. Empty placeholder segment ───────────────────────────────────
        // Only meaningful for active contracts; skipped when filtering by a real status.
        var emptyCount = 0;
        IQueryable<TechnicalDrawingEmptyRowDto>? emptyQuery = null;

        if (isActive != false && (!status.HasValue || onlyMissing == true))
        {
            var contractsQuery = _context.Contracts.AsNoTracking().Where(c => c.IsActive);

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

            // One row per product that still lacks an active drawing. Rooted at
            // the products table rather than walking the contract's collection —
            // that keeps it a plain anti-join instead of a lateral nested loop.
            var productsQuery = _context.ContractProducts.AsNoTracking()
                .Where(p => p.Contract!.IsActive);

            if (!viewAll)
                productsQuery = productsQuery.Where(p => contractsQuery.Select(c => c.Id).Contains(p.ContractId));

            var productRows = productsQuery
                .Where(p => !_context.TechnicalDrawings.Any(d => d.IsActive && d.ContractProductId == p.Id))
                .Select(p => new TechnicalDrawingEmptyRowDto
                {
                    ContractId = p.ContractId,
                    ContractNo = p.Contract!.ContractNo,
                    ProductId = p.Id,
                    ProductType = p.ProductType,
                    Quantity = p.Quantity,
                    Unit = p.Unit,
                });

            // …plus a single contract-level row for product-less contracts.
            var contractRows = contractsQuery
                .Where(c => !c.Products.Any() &&
                            !_context.TechnicalDrawings.Any(d => d.IsActive && d.ContractId == c.Id))
                .Select(c => new TechnicalDrawingEmptyRowDto
                {
                    ContractId = c.Id,
                    ContractNo = c.ContractNo,
                    ProductId = null,
                    ProductType = null,
                    Quantity = null,
                    Unit = null,
                });

            emptyQuery = productRows.Concat(contractRows);

            if (lower != null)
            {
                emptyQuery = emptyQuery.Where(e =>
                    e.ContractNo.ToLower().Contains(lower) ||
                    (e.ProductType != null && e.ProductType.ToLower().Contains(lower)));
            }

            emptyCount = await emptyQuery.CountAsync();
        }

        // ── 3. Slice the requested page across the segments ────────────────
        var page = pagination.Page < 1 ? 1 : pagination.Page;
        var remainingSkip = (page - 1) * pagination.PageSize;
        var remainingTake = pagination.PageSize;

        (int Skip, int Take) NextSlice(int segmentCount)
        {
            if (remainingTake <= 0 || segmentCount <= 0)
                return (0, 0);
            if (remainingSkip >= segmentCount)
            {
                remainingSkip -= segmentCount;
                return (0, 0);
            }

            var skip = remainingSkip;
            var take = Math.Min(remainingTake, segmentCount - skip);
            remainingSkip = 0;
            remainingTake -= take;
            return (skip, take);
        }

        var emptySlice = NextSlice(emptyCount);
        var draftSlice = NextSlice(draftCount);
        var otherSlice = NextSlice(otherCount);

        var rows = new List<TechnicalDrawingRowDto>(pagination.PageSize);

        if (emptySlice.Take > 0)
        {
            var emptyRows = await emptyQuery!
                .OrderBy(e => e.ContractNo)
                .ThenBy(e => e.ProductType)
                .ThenBy(e => e.ProductId)
                .Skip(emptySlice.Skip)
                .Take(emptySlice.Take)
                .ToListAsync();

            rows.AddRange(emptyRows.Select(e => new TechnicalDrawingRowDto
            {
                Kind = TechnicalDrawingRowKind.Empty,
                Empty = e,
            }));
        }

        if (draftSlice.Take > 0)
            rows.AddRange(await FetchDrawingsAsync(drawingsQuery!.Where(d => d.Status == DrawingStatus.Draft), draftSlice));

        if (otherSlice.Take > 0)
            rows.AddRange(await FetchDrawingsAsync(drawingsQuery!.Where(d => d.Status != DrawingStatus.Draft), otherSlice));

        var paged = PagedResult<TechnicalDrawingRowDto>.Create(rows, emptyCount + draftCount + otherCount, pagination);
        return ApiResult<PagedResult<TechnicalDrawingRowDto>>.Success(paged);
    }

    // Newest first, with Id as tiebreaker so page boundaries stay stable.
    private static async Task<List<TechnicalDrawingRowDto>> FetchDrawingsAsync(
        IQueryable<TechnicalDrawing> query, (int Skip, int Take) slice)
        => await query
            .OrderByDescending(d => d.CreatedAt)
            .ThenByDescending(d => d.Id)
            .Skip(slice.Skip)
            .Take(slice.Take)
            .Select(d => new TechnicalDrawingRowDto
            {
                Kind = TechnicalDrawingRowKind.Drawing,
                Drawing = new TechnicalDrawingResponseDto
                {
                    Id = d.Id,
                    ContractId = d.ContractId,
                    ContractNo = d.Contract != null ? d.Contract.ContractNo : "",
                    ContractProductId = d.ContractProductId,
                    ProductType = d.ContractProduct != null ? d.ContractProduct.ProductType : null,
                    Title = d.Title,
                    Notes = d.Notes,
                    Status = d.Status,
                    CreatedByFullName = d.Creator != null ? d.Creator.FirstName + " " + d.Creator.LastName : null,
                    CreatedAt = d.CreatedAt,
                    IsActive = d.IsActive,
                },
            })
            .ToListAsync();

    public async Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy)
    {
        var contractNo = await _context.Contracts
            .Where(c => c.Id == dto.ContractId)
            .Select(c => c.ContractNo)
            .FirstOrDefaultAsync();
        if (contractNo is null)
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
            $"Yangi texnik chizma yuklandi: {contractNo}",
            $"«{contractNo}» shartnomasi uchun «{drawing.Title}» texnik chizmasi yuklandi.",
            NotificationType.Info,
            dto.ContractId);

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

        var approved = status == DrawingStatus.Approved && drawing.Contract is not null;

        if (approved)
        {
            // Per-product flow: lift the specific product (or every product
            // when the drawing is contract-level legacy) past DrawingPending.
            if (drawing.ContractProductId.HasValue)
            {
                var product = await _context.ContractProducts
                    .FirstOrDefaultAsync(p => p.Id == drawing.ContractProductId.Value);
                if (product is not null)
                    ContractStatusHelper.TryAdvanceToTechProcessing(product);
            }
            else
            {
                var products = await _context.ContractProducts
                    .Where(p => p.ContractId == drawing.ContractId && p.IsActive)
                    .ToListAsync();
                foreach (var p in products)
                    ContractStatusHelper.TryAdvanceToTechProcessing(p);
            }
        }

        await _context.SaveChangesAsync();

        if (!approved)
            return ApiResult<int>.Success(200);

        var contractMoved = await ContractStatusHelper.RecomputeContractStatusAsync(_context, drawing.ContractId);
        await _context.SaveChangesAsync();

        var contractNo = drawing.Contract!.ContractNo;

        // Everyone tied to the contract — through a department or directly.
        var recipientIds = await _context.Users
            .Where(u => (u.IsActive && _context.ContractDepartments
                            .Any(cd => cd.ContractId == drawing.ContractId && cd.DepartmentId == u.DepartmentId))
                        || _context.ContractUsers
                            .Any(cu => cu.ContractId == drawing.ContractId && cu.UserId == u.Id))
            .Select(u => u.Id)
            .ToListAsync();

        var body = contractMoved
            ? $"«{contractNo}» shartnomasi texnik chizmasi tasdiqlandi. Shartnoma holati «Tex jarayon tayyorlanmoqda» ga o'zgardi."
            : $"«{contractNo}» shartnomasi uchun «{drawing.Title}» texnik chizmasi tasdiqlandi.";

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            recipientIds, $"Texnik chizma tasdiqlandi: {contractNo}", body, NotificationType.Task, drawing.ContractId);

        return ApiResult<int>.Success(200);
    }
}
