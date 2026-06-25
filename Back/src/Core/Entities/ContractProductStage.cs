using Core.Enums;

namespace Core.Entities;

// A single stage instance on a ContractProduct's workflow — the per-product
// snapshot of the chosen template (or override). Only enabled stages exist;
// the engine maintains Status from the underlying drawing/TP/CN/task state.
public class ContractProductStage
{
    public Guid Id { get; set; }
    public Guid ContractProductId { get; set; }
    public StageType StageType { get; set; }
    public int OrderIndex { get; set; }
    public StageStatus Status { get; set; } = StageStatus.Pending;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation
    public ContractProduct? ContractProduct { get; set; }
}
