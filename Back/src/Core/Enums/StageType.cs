namespace Core.Enums;

// The known production-stage capabilities the system implements. A workflow is
// an ordered, optional subset of these. Each maps to a concrete entity + page:
//   Drawing     → TechnicalDrawing  (/technicaldrawings)
//   TechProcess → TechProcess       (/techprocess)
//   CostNorm    → CostNorm          (/costnorm)
//   Tasks       → ContractTask      (/tasks)
public enum StageType
{
    Drawing     = 1,
    TechProcess = 2,
    CostNorm    = 3,
    Tasks       = 4,
}
