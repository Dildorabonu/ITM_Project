using Application.DTOs;
using Application.DTOs.TechProcesses;
using Application.Helpers;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using SysTask = System.Threading.Tasks.Task;


namespace Application.Services.Impl;

public class TechProcessService : ITechProcessService
{
    private readonly DatabaseContext _context;
    private readonly INotificationService _notificationService;
    private readonly IManufacturedProductService _manufacturedProductService;

    public TechProcessService(
        DatabaseContext context,
        INotificationService notificationService,
        IManufacturedProductService manufacturedProductService)
    {
        _context = context;
        _notificationService = notificationService;
        _manufacturedProductService = manufacturedProductService;
    }

    public async Task<ApiResult<IEnumerable<TechProcessResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, ProcessStatus? status = null, bool? isActive = null)
    {
        var query = _context.TechProcesses.AsNoTracking();

        if (!viewAll)
        {
            query = query.Where(t =>
                _context.ContractUsers.Any(cu => cu.ContractId == t.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == t.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)) ||
                (t.ContractProductId != null && (
                    _context.ContractProductUsers.Any(pu => pu.ContractProductId == t.ContractProductId && pu.UserId == currentUserId) ||
                    _context.ContractProductDepartments.Any(pd => pd.ContractProductId == t.ContractProductId &&
                        _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == pd.DepartmentId))
                )));
        }

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        if (isActive.HasValue)
            query = query.Where(t => t.IsActive == isActive.Value);

        var list = await query
            .OrderByDescending(t => t.CreatedAt)
            .Select(ToResponse)
            .ToListAsync();

        return ApiResult<IEnumerable<TechProcessResponseDto>>.Success(list);
    }

    public async Task<ApiResult<TechProcessResponseDto>> GetByIdAsync(Guid id)
    {
        var tp = await _context.TechProcesses
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(ToResponse)
            .FirstOrDefaultAsync();

        if (tp is null)
            return ApiResult<TechProcessResponseDto>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        return ApiResult<TechProcessResponseDto>.Success(tp);
    }

    public async Task<ApiResult<Guid>> CreateAsync(TechProcessCreateDto dto)
    {
        // One read covers both the existence check and the notification text.
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

        var tp = new TechProcess
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
            ContractProductId = dto.ContractProductId,
            Title = dto.Title,
            Notes = dto.Notes,
            Status = ProcessStatus.InProgress,
            CurrentStep = 0,
            CreatedAt = DateTime.UtcNow
        };

        _context.TechProcesses.Add(tp);

        // Lift the affected product(s) past DrawingPending; Contract.Status is
        // recomputed below from the per-product aggregate. Only DrawingPending
        // rows can move, so the filter belongs in the query rather than loading
        // every product of the contract to no effect.
        var pending = _context.ContractProducts
            .Where(p => p.Status == ContractProductStatus.DrawingPending);

        pending = dto.ContractProductId.HasValue
            ? pending.Where(p => p.Id == dto.ContractProductId.Value)
            : pending.Where(p => p.ContractId == dto.ContractId && p.IsActive);

        foreach (var p in await pending.ToListAsync())
            ContractStatusHelper.TryAdvanceToTechProcessing(p);

        await _context.SaveChangesAsync();
        await ContractStatusHelper.RecomputeContractStatusAsync(_context, dto.ContractId);
        await _context.SaveChangesAsync();

        var deptUserIds = await _context.Users
            .Where(u => u.IsActive && _context.ContractDepartments
                .Any(cd => cd.ContractId == dto.ContractId && cd.DepartmentId == u.DepartmentId))
            .Select(u => u.Id)
            .ToListAsync();

        await _notificationService.NotifyUsersAndSuperAdminsAsync(
            deptUserIds,
            $"Tex jarayon yaratildi: {contractNo}",
            $"«{contractNo}» shartnomasi uchun «{tp.Title}» tex jarayoni yaratildi.",
            NotificationType.Info,
            dto.ContractId);

        return ApiResult<Guid>.Success(tp.Id, 201);
    }

    // After a TP or CN approval, a single product may now have both approved
    // and can move to InProduction independently of its siblings.
    private async SysTask AdvanceProductIfReadyAsync(Guid? productId)
    {
        if (!productId.HasValue) return;

        var product = await _context.ContractProducts.FirstOrDefaultAsync(p => p.Id == productId.Value);
        if (product is null) return;
        if (product.Status == ContractProductStatus.InProduction
            || product.Status == ContractProductStatus.Completed
            || product.Status == ContractProductStatus.Cancelled)
            return;

        if (!await ContractStatusHelper.IsProductReadyForProductionAsync(_context, product.Id))
            return;

        product.Status = ContractProductStatus.InProduction;
        await _context.SaveChangesAsync();
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, TechProcessUpdateDto dto)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status == ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Tasdiqlangan jarayonni tahrirlash mumkin emas."]);

        if (dto.Title is not null) tp.Title = dto.Title;
        if (dto.Notes is not null) tp.Notes = dto.Notes;

        if (dto.ClearContractProduct)
        {
            tp.ContractProductId = null;
        }
        else if (dto.ContractProductId.HasValue)
        {
            var productOk = await _context.ContractProducts
                .AnyAsync(p => p.Id == dto.ContractProductId.Value && p.ContractId == tp.ContractId);
            if (!productOk)
                return ApiResult<int>.Failure(["Tanlangan mahsulot ushbu shartnomaga tegishli emas."]);
            tp.ContractProductId = dto.ContractProductId.Value;
        }

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(1);
    }

    public async Task<ApiResult<int>> ApproveAsync(Guid id, Guid approvedBy)
    {
        var tp = await _context.TechProcesses.FirstOrDefaultAsync(t => t.Id == id);
        if (tp is null)
            return ApiResult<int>.Failure([$"TechProcess '{id}' topilmadi."], 404);

        if (tp.Status == ProcessStatus.Approved)
            return ApiResult<int>.Failure(["Jarayon allaqachon tasdiqlangan."]);

        tp.Status = ProcessStatus.Approved;
        tp.ApprovedBy = approvedBy;
        tp.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await AdvanceProductIfReadyAsync(tp.ContractProductId);
        await ContractStatusHelper.RecomputeContractStatusAsync(_context, tp.ContractId);
        await _context.SaveChangesAsync();
        await _manufacturedProductService.SyncForContractAsync(tp.ContractId);

        var contractNo = await _context.Contracts
            .Where(c => c.Id == tp.ContractId)
            .Select(c => c.ContractNo)
            .FirstOrDefaultAsync();

        if (contractNo is not null)
        {
            // Department members and directly assigned users in one round trip;
            // the database does the union and the de-duplication.
            var recipientIds = await _context.Users
                .Where(u => u.IsActive && _context.ContractDepartments
                    .Any(cd => cd.ContractId == tp.ContractId && cd.DepartmentId == u.DepartmentId))
                .Select(u => u.Id)
                .Union(_context.ContractUsers
                    .Where(cu => cu.ContractId == tp.ContractId)
                    .Select(cu => cu.UserId))
                .ToListAsync();

            await _notificationService.NotifyUsersAndSuperAdminsAsync(
                recipientIds,
                $"Tex jarayon tasdiqlandi: {contractNo}",
                $"«{contractNo}» shartnomasi uchun «{tp.Title}» tex jarayoni tasdiqlandi.",
                NotificationType.Task,
                tp.ContractId);
        }

        return ApiResult<int>.Success(1);
    }

    // ── Mapping ────────────────────────────────────────────────────────────────

    // Kept as an expression so EF builds the SELECT list from it: the related
    // contract / product / approver rows are never materialised, only the nine
    // columns the response actually carries.
    private static readonly Expression<Func<TechProcess, TechProcessResponseDto>> ToResponse =
        tp => new TechProcessResponseDto
        {
            Id = tp.Id,
            ContractNo = tp.Contract != null ? tp.Contract.ContractNo : string.Empty,
            ProductType = tp.ContractProduct != null ? tp.ContractProduct.ProductType : null,
            Title = tp.Title,
            Notes = tp.Notes,
            Status = tp.Status,
            ApprovedByFullName = tp.Approver != null
                ? tp.Approver.FirstName + " " + tp.Approver.LastName
                : null,
            ApprovedAt = tp.ApprovedAt,
            CreatedAt = tp.CreatedAt,
        };
}
