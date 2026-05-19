namespace Application.DTOs.CostNorms;

// Design/metadata blocks extracted from the user's uploaded DOCX. Persisted as
// JSON on CostNorm.MetadataJson so the regenerated DOCX preserves the user's
// approval headers, signature names, and bottom note.
public class CostNormMetadataDto
{
    public List<string> ApprovalLeft { get; set; } = [];
    public List<string> ApprovalRight { get; set; } = [];
    public List<SignatureLineDto> Signatures { get; set; } = [];
    public string? FooterNote { get; set; }
}

public class SignatureLineDto
{
    public string Title { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
