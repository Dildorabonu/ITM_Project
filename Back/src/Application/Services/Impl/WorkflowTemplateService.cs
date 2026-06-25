using Application.DTOs;
using Application.DTOs.Workflows;
using Core.Entities;
using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Services.Impl;

public class WorkflowTemplateService : IWorkflowTemplateService
{
    private readonly DatabaseContext _context;

    public WorkflowTemplateService(DatabaseContext context)
    {
        _context = context;
    }

    public async Task<ApiResult<IEnumerable<WorkflowTemplateResponseDto>>> GetAllAsync(bool? isActive = null)
    {
        var query = _context.WorkflowTemplates
            .Include(t => t.Stages)
            .Include(t => t.Creator)
            .AsNoTracking()
            .AsQueryable();

        if (isActive.HasValue)
            query = query.Where(t => t.IsActive == isActive.Value);

        var templates = await query
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .ToListAsync();

        return ApiResult<IEnumerable<WorkflowTemplateResponseDto>>.Success(templates.Select(MapToResponse));
    }

    public async Task<ApiResult<WorkflowTemplateResponseDto>> GetByIdAsync(Guid id)
    {
        var template = await _context.WorkflowTemplates
            .Include(t => t.Stages)
            .Include(t => t.Creator)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template is null)
            return ApiResult<WorkflowTemplateResponseDto>.Failure([$"Ish jarayoni shabloni '{id}' topilmadi."], 404);

        return ApiResult<WorkflowTemplateResponseDto>.Success(MapToResponse(template));
    }

    public async Task<ApiResult<Guid>> CreateAsync(WorkflowTemplateCreateDto dto, Guid createdBy)
    {
        var validation = ValidateStages(dto.Stages);
        if (validation is not null)
            return ApiResult<Guid>.Failure([validation], 400);

        if (string.IsNullOrWhiteSpace(dto.Name))
            return ApiResult<Guid>.Failure(["Shablon nomi bo'sh bo'lishi mumkin emas."], 400);

        var template = new WorkflowTemplate
        {
            Id = Guid.NewGuid(),
            Name = dto.Name.Trim(),
            IsActive = true,
            IsDefault = dto.IsDefault,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        };

        if (dto.IsDefault)
            await ClearOtherDefaultsAsync(template.Id);

        var orderIdx = 0;
        foreach (var stageType in dto.Stages.Distinct())
        {
            template.Stages.Add(new WorkflowTemplateStage
            {
                Id = Guid.NewGuid(),
                WorkflowTemplateId = template.Id,
                StageType = stageType,
                OrderIndex = orderIdx++,
            });
        }

        _context.WorkflowTemplates.Add(template);
        await _context.SaveChangesAsync();

        return ApiResult<Guid>.Success(template.Id, 201);
    }

    public async Task<ApiResult<int>> UpdateAsync(Guid id, WorkflowTemplateUpdateDto dto)
    {
        var template = await _context.WorkflowTemplates
            .Include(t => t.Stages)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template is null)
            return ApiResult<int>.Failure([$"Ish jarayoni shabloni '{id}' topilmadi."], 404);

        if (dto.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return ApiResult<int>.Failure(["Shablon nomi bo'sh bo'lishi mumkin emas."], 400);
            template.Name = dto.Name.Trim();
        }

        if (dto.IsActive.HasValue)
            template.IsActive = dto.IsActive.Value;

        if (dto.IsDefault == true)
        {
            await ClearOtherDefaultsAsync(template.Id);
            template.IsDefault = true;
        }
        else if (dto.IsDefault == false)
        {
            template.IsDefault = false;
        }

        if (dto.Stages is not null)
        {
            var validation = ValidateStages(dto.Stages);
            if (validation is not null)
                return ApiResult<int>.Failure([validation], 400);

            _context.WorkflowTemplateStages.RemoveRange(template.Stages);
            var orderIdx = 0;
            foreach (var stageType in dto.Stages.Distinct())
            {
                template.Stages.Add(new WorkflowTemplateStage
                {
                    Id = Guid.NewGuid(),
                    WorkflowTemplateId = template.Id,
                    StageType = stageType,
                    OrderIndex = orderIdx++,
                });
            }
        }

        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> SetDefaultAsync(Guid id)
    {
        var template = await _context.WorkflowTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template is null)
            return ApiResult<int>.Failure([$"Ish jarayoni shabloni '{id}' topilmadi."], 404);

        if (!template.IsActive)
            return ApiResult<int>.Failure(["Nofaol shablonni asosiy qilib bo'lmaydi."], 400);

        await ClearOtherDefaultsAsync(template.Id);
        template.IsDefault = true;
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    public async Task<ApiResult<int>> DeleteAsync(Guid id)
    {
        var template = await _context.WorkflowTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template is null)
            return ApiResult<int>.Failure([$"Ish jarayoni shabloni '{id}' topilmadi."], 404);

        // Soft delete; clear the default flag so the partial unique index stays
        // free and the resolver falls back correctly.
        template.IsActive = false;
        template.IsDefault = false;
        await _context.SaveChangesAsync();
        return ApiResult<int>.Success(200);
    }

    // Unsets IsDefault on every other template so the partial unique index holds.
    private async System.Threading.Tasks.Task ClearOtherDefaultsAsync(Guid keepId)
    {
        var others = await _context.WorkflowTemplates
            .Where(t => t.IsDefault && t.Id != keepId)
            .ToListAsync();
        foreach (var t in others)
            t.IsDefault = false;
    }

    private static string? ValidateStages(List<StageType> stages)
    {
        if (stages is null || stages.Count == 0)
            return "Ish jarayoni uchun kamida bitta bosqich tanlanishi shart.";
        if (stages.Distinct().Count() != stages.Count)
            return "Bir bosqich ikki marta tanlanishi mumkin emas.";
        return null;
    }

    private static WorkflowTemplateResponseDto MapToResponse(WorkflowTemplate t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        IsActive = t.IsActive,
        IsDefault = t.IsDefault,
        Stages = t.Stages.OrderBy(s => s.OrderIndex).Select(s => s.StageType).ToList(),
        CreatedByFullName = t.Creator is not null ? $"{t.Creator.FirstName} {t.Creator.LastName}" : null,
        CreatedAt = t.CreatedAt,
    };
}
