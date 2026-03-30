using System.Collections.Generic;

namespace Application.DTOs.CostNorms;

public class CostNormUpdateDto
{
    public string? Title { get; set; }
    public string? Notes { get; set; }
    public List<CostNormItemCreateDto>? Items { get; set; }
}
