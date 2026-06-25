namespace Core.Enums;

// Status of a single stage instance on a ContractProduct's workflow.
// Only enabled stages are persisted as ContractProductStage rows; a stage type
// with no row is implicitly skipped from the workflow.
public enum StageStatus
{
    Pending    = 0,
    InProgress = 1,
    Done       = 2,
    Skipped    = 3,
}
