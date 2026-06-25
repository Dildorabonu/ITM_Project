using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Helpers;

// Single source of truth for production-stage progression. Replaces the scattered
// hardcoded transitions (TryAdvanceToTechProcessing / IsProductReadyForProduction /
// AdvanceProductIfReady / manual Status assignments).
//
// Given a ContractProduct's ordered, enabled stages (ContractProductStage rows)
// and the live state of its drawing / tech-process / cost-norm / task entities,
// it recomputes each stage's StageStatus, the current stage, and the derived
// ContractProduct.Status cache the rest of the system still reads.
public static class WorkflowEngine
{
    // Must match the warehouse handoff task name used across the services.
    private const string WarehouseTaskName = "Tayyor mahsulotni omborga topshirish";

    // Canonical fallback order for products without explicit stage rows
    // (legacy data prior to backfill, or a transient state).
    private static readonly StageType[] DefaultOrder =
        [StageType.Drawing, StageType.TechProcess, StageType.CostNorm, StageType.Tasks];

    // Recomputes a single product's stage statuses + its derived Status cache.
    // Mutates tracked entities; the CALLER is responsible for SaveChangesAsync.
    // Returns true if the derived ContractProduct.Status value changed.
    public static async Task<bool> RecomputeProductStagesAsync(DatabaseContext context, Guid productId)
    {
        var product = await context.ContractProducts
            .Include(p => p.Stages)
            .FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null) return false;

        // Cancelled is a terminal lifecycle state managed by (de)activation —
        // never derived away here.
        if (product.Status == ContractProductStatus.Cancelled) return false;

        var contractId = product.ContractId;

        // Intrinsic "done" of each known stage type from the underlying entities.
        // Both product-scoped and contract-level (null) records count — matching
        // the legacy fall-through where a contract-level artifact applies to every
        // product of the contract.
        var doneByType = new Dictionary<StageType, bool>
        {
            [StageType.Drawing] = await context.TechnicalDrawings.AnyAsync(d =>
                d.ContractId == contractId && d.IsActive
                && (d.ContractProductId == productId || d.ContractProductId == null)
                && d.Status == DrawingStatus.Approved),

            [StageType.TechProcess] = await context.TechProcesses.AnyAsync(t =>
                t.ContractId == contractId && t.IsActive
                && (t.ContractProductId == productId || t.ContractProductId == null)
                && (t.Status == ProcessStatus.Approved || t.Status == ProcessStatus.Completed)),

            [StageType.CostNorm] = await context.CostNorms.AnyAsync(c =>
                c.ContractId == contractId && c.IsActive
                && (c.ContractProductId == productId || c.ContractProductId == null)
                && c.Status == DrawingStatus.Approved
                && c.Items.Any(i => i.IsActive)),

            [StageType.Tasks] = await context.ContractTasks.AnyAsync(t =>
                t.ContractId == contractId && t.IsActive
                && t.ContractProductId == productId
                && t.Name == WarehouseTaskName
                && t.TotalAmount > 0 && t.CompletedAmount >= t.TotalAmount),
        };

        var stages = product.Stages.OrderBy(s => s.OrderIndex).ToList();
        var enabledOrder = stages.Count > 0
            ? stages.Select(s => s.StageType).ToList()
            : DefaultOrder.ToList();

        // Ratchet: a stage already marked Done stays Done even if its underlying
        // artifact is later reverted/deactivated. This prevents an in-production
        // product from silently regressing (and preserves coarse backfilled state
        // for legacy data whose drawing was never formally approved).
        var doneSoFar = stages
            .Where(s => s.Status == StageStatus.Done)
            .Select(s => s.StageType)
            .ToHashSet();

        bool EffectiveDone(StageType st) => doneByType[st] || doneSoFar.Contains(st);

        // Current stage = first enabled stage whose work is not yet done.
        var currentIdx = enabledOrder.FindIndex(st => !EffectiveDone(st));
        var allDone = currentIdx < 0;

        var now = DateTime.UtcNow;

        // Update the explicit stage rows (no-op when none exist).
        for (var i = 0; i < stages.Count; i++)
        {
            var stage = stages[i];
            var newStatus = EffectiveDone(stage.StageType) ? StageStatus.Done
                : i == currentIdx ? StageStatus.InProgress
                : StageStatus.Pending;

            stage.Status = newStatus;
            if (newStatus is StageStatus.InProgress or StageStatus.Done)
                stage.StartedAt ??= now;
            stage.CompletedAt = newStatus == StageStatus.Done ? stage.CompletedAt ?? now : null;
        }

        var derived = DeriveProductStatus(enabledOrder, currentIdx, allDone);
        var changed = product.Status != derived;
        product.Status = derived;
        return changed;
    }

    // Recomputes every active product of a contract, then the contract aggregate.
    // Caller is responsible for SaveChangesAsync.
    public static async Task RecomputeContractAsync(DatabaseContext context, Guid contractId)
    {
        var productIds = await context.ContractProducts
            .Where(p => p.ContractId == contractId && p.IsActive)
            .Select(p => p.Id)
            .ToListAsync();

        foreach (var pid in productIds)
            await RecomputeProductStagesAsync(context, pid);

        await ContractStatusHelper.RecomputeContractStatusAsync(context, contractId);
    }

    // Maps the dynamic stage walk onto the legacy 4-value status cache.
    private static ContractProductStatus DeriveProductStatus(
        List<StageType> order, int currentIdx, bool allDone)
    {
        if (allDone)
            return order.Count == 0 ? ContractProductStatus.DrawingPending : ContractProductStatus.Completed;

        var current = order[currentIdx];

        // Map by the ACTUAL current stage type, not its position — a dynamic
        // workflow may start at TechProcess (no Drawing), so position 0 ≠ Drawing.
        return current switch
        {
            // Drawing outstanding ⇒ the drawing phase.
            StageType.Drawing => ContractProductStatus.DrawingPending,
            // Tasks reachable ⇒ production phase (drives ManufacturedProduct sync).
            StageType.Tasks => ContractProductStatus.InProduction,
            // TechProcess / CostNorm are pre-production prep ⇒ tech-processing.
            _ => ContractProductStatus.TechProcessing,
        };
    }

    // The current (in-progress) stage type of a product, or null when complete
    // or when there are no enabled stages. Used by API responses for page gating.
    public static StageType? CurrentStage(IEnumerable<Core.Entities.ContractProductStage> stages)
    {
        var ordered = stages.OrderBy(s => s.OrderIndex).ToList();
        var current = ordered.FirstOrDefault(s => s.Status == StageStatus.InProgress);
        return current?.StageType;
    }
}
