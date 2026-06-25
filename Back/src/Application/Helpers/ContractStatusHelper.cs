using Core.Enums;
using DataAccess.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Application.Helpers;

// Per-product workflow is the source of truth: each ContractProduct moves
// independently through its (now configurable) ordered stages — see WorkflowEngine.
// Contract.Status is a derived aggregate kept on the row for query filtering —
// it equals the earliest stage among the contract's active products.
public static class ContractStatusHelper
{
    // Recomputes Contract.Status from its active products.
    // Returns true if the value changed.
    public static async Task<bool> RecomputeContractStatusAsync(DatabaseContext context, Guid contractId)
    {
        var contract = await context.Contracts.FirstOrDefaultAsync(c => c.Id == contractId);
        if (contract is null) return false;

        // Cancelled contracts stay cancelled at the contract level — that's a
        // lifecycle state, not derived from products.
        if (!contract.IsActive || contract.Status == ContractStatus.Cancelled)
            return false;

        var productStatuses = await context.ContractProducts
            .Where(p => p.ContractId == contractId && p.IsActive)
            .Select(p => p.Status)
            .ToListAsync();

        if (productStatuses.Count == 0)
            return false;

        // Skip Cancelled products when aggregating — they don't represent the
        // active workflow.
        var active = productStatuses
            .Where(s => s != ContractProductStatus.Cancelled)
            .ToList();
        if (active.Count == 0)
            return false;

        // Earliest stage wins: if any product is still in DrawingPending, the
        // contract is in DrawingPending. Only when all reach Completed does the
        // contract become Completed.
        var minStage = active.Min(s => (int)s);
        var derived = (ContractStatus)minStage;

        if (contract.Status == derived) return false;
        contract.Status = derived;
        return true;
    }
}
