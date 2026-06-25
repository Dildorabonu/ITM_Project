using System.Text.Json.Serialization;
using Core.Enums;

namespace Application.DTOs.Contracts;

public class ContractReadinessDrawingDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DrawingStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ContractReadinessTechProcessDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public ProcessStatus Status { get; set; }
    public int CurrentStep { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ContractReadinessCostNormDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DrawingStatus Status { get; set; }
    public int ItemCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ContractReadinessDto
{
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public bool ContractIsActive { get; set; }

    public Guid? ContractProductId { get; set; }
    public string? ProductType { get; set; }
    public int? ProductQuantity { get; set; }
    public string? ProductUnit { get; set; }

    [JsonPropertyName("drawing")]
    public ContractReadinessDrawingDto? Drawing { get; set; }

    [JsonPropertyName("tp")]
    public ContractReadinessTechProcessDto? TechProcess { get; set; }

    [JsonPropertyName("cn")]
    public ContractReadinessCostNormDto? CostNorm { get; set; }

    // Dynamic workflow: the product's ordered, enabled stages + the current one.
    // Pages use these to decide whether a scope belongs to / is reachable at their stage.
    public List<StageType> Stages { get; set; } = [];
    public StageType? CurrentStage { get; set; }

    /// <summary>
    /// 0 — drawing tasdiqlangan, lekin TP yoki Me'yoriy sarf tasdiqlanmagan (eng yuqori prioritet).<br/>
    /// 1 — texnik chizma yaratilgan, lekin tasdiqlanmagan.<br/>
    /// 2 — texnik chizma umuman yaratilmagan.<br/>
    /// 3 — to'liq yakunlangan (drawing + TP + CN tasdiqlangan).
    /// </summary>
    public int Priority { get; set; }
}
