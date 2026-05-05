namespace Core.Enums;

// Each ContractProduct progresses through its own workflow because drawings,
// tech processes and cost norms are tracked per product. Contract.Status is
// derived from the minimum stage among its active products.
public enum ContractProductStatus
{
    DrawingPending = 1,
    TechProcessing = 2,
    InProduction   = 4,
    Completed      = 5,
    Cancelled      = 6,
}
