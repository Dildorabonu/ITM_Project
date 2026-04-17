using Application.DTOs;
using Application.DTOs.TechnicalDrawings;
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

    public async Task<ApiResult<IEnumerable<TechnicalDrawingResponseDto>>> GetAllAsync(Guid currentUserId, bool viewAll, DrawingStatus? status = null)
    {
        var query = _context.TechnicalDrawings
            .Include(d => d.Contract)
            .Include(d => d.Creator)
            .AsNoTracking()
            .AsQueryable();

        if (!viewAll)
        {
            query = query.Where(d =>
                _context.ContractUsers.Any(cu => cu.ContractId == d.ContractId && cu.UserId == currentUserId) ||
                _context.ContractDepartments.Any(cd => cd.ContractId == d.ContractId &&
                    _context.Users.Any(u => u.Id == currentUserId && u.DepartmentId == cd.DepartmentId)));
        }

        if (status.HasValue)
            query = query.Where(d => d.Status == status.Value);

        var list = await query.OrderByDescending(d => d.CreatedAt).ToListAsync();
        return ApiResult<IEnumerable<TechnicalDrawingResponseDto>>.Success(list.Select(MapToResponse));
    }

    public async Task<ApiResult<TechnicalDrawingResponseDto>> GetByIdAsync(Guid id)
    {
        var drawing = await _context.TechnicalDrawings
            .Include(d => d.Contract)
            .Include(d => d.Creator)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id);

        if (drawing is null)
            return ApiResult<TechnicalDrawingResponseDto>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        return ApiResult<TechnicalDrawingResponseDto>.Success(MapToResponse(drawing));
    }

    public async Task<ApiResult<Guid>> CreateAsync(TechnicalDrawingCreateDto dto, Guid createdBy)
    {
        var contract = await _context.Contracts.FirstOrDefaultAsync(c => c.Id == dto.ContractId);
        if (contract is null)
            return ApiResult<Guid>.Failure([$"Shartnoma '{dto.ContractId}' topilmadi."]);

        var drawing = new TechnicalDrawing
        {
            Id = Guid.NewGuid(),
            ContractId = dto.ContractId,
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

        if (dto.Title is not null) drawing.Title = dto.Title;
        if (dto.Notes is not null) drawing.Notes = dto.Notes;

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

        var contractMoved = false;
        if (status == DrawingStatus.Approved && drawing.Contract is not null &&
            drawing.Contract.Status == ContractStatus.DrawingPending)
        {
            drawing.Contract.Status = ContractStatus.TechProcessing;
            contractMoved = true;
        }

        await _context.SaveChangesAsync();

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

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var drawing = await _context.TechnicalDrawings.FirstOrDefaultAsync(d => d.Id == id);
        if (drawing is null)
            return ApiResult<int>.Failure([$"Texnik chizma '{id}' topilmadi."], 404);

        await _attachmentService.DeleteAllAsync("technicaldrawings", id);
        _context.TechnicalDrawings.Remove(drawing);
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    private static TechnicalDrawingResponseDto MapToResponse(TechnicalDrawing d) => new()
    {
        Id = d.Id,
        ContractId = d.ContractId,
        ContractNo = d.Contract?.ContractNo ?? "",
        Title = d.Title,
        Notes = d.Notes,
        Status = d.Status,
        CreatedBy = d.CreatedBy,
        CreatedByFullName = d.Creator is not null ? $"{d.Creator.FirstName} {d.Creator.LastName}" : null,
        CreatedAt = d.CreatedAt,
        IsActive = d.Contract?.IsActive ?? true,
    };
}
