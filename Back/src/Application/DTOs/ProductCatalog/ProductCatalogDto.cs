using Core.Enums;

namespace Application.DTOs.ProductCatalog;

public class ProductCatalogCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
}

public class ProductCatalogUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
}

public class ProductCatalogResponseDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
    // Nechta shartnoma mahsuloti shu katalog yozuviga bog'langan — o'chirishdan oldin ogohlantirish uchun.
    public int UsageCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ─── "Ko'rish" (detali) infografikasi uchun ──────────────────────────────────
// Bitta katalog mahsuloti bo'yicha to'liq manzara: qaysi shartnomalarga bog'langan,
// jami buyurtma va ishlab chiqarilgan miqdor, holat taqsimoti.

public class ProductCatalogDetailDto
{
    // Sarlavha ma'lumotlari
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Unit { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }

    // Agregatlar (stat kartalar)
    public int ContractCount { get; set; }          // Nechta shartnomada ishlatilgan
    public int ActiveContractCount { get; set; }    // Faol shartnomalar soni
    public int TotalOrderedQuantity { get; set; }   // Jami buyurtma miqdori (ContractProduct.Quantity)
    public decimal TotalProducedQuantity { get; set; } // Jami ishlab chiqarilgan (ManufacturedProduct.ProducedQuantity)
    public int CompletedProductCount { get; set; }  // Yakunlangan mahsulot qatorlari

    // Har bir bosqichdagi mahsulot qatorlari soni — donut/bar diagramma uchun.
    public List<ProductCatalogStatusCountDto> StatusBreakdown { get; set; } = [];

    // Bog'langan shartnomalar ro'yxati
    public List<ProductCatalogContractUsageDto> Contracts { get; set; } = [];
}

public class ProductCatalogStatusCountDto
{
    public ContractProductStatus Status { get; set; }
    public int Count { get; set; }
}

public class ProductCatalogContractUsageDto
{
    public Guid ContractProductId { get; set; }
    public Guid ContractId { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractParty { get; set; } = string.Empty;
    public ContractType ContractType { get; set; }
    public ContractStatus ContractStatus { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public bool ContractIsActive { get; set; }

    // Shu shartnomadagi mahsulot qatorining ma'lumotlari
    public int Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
    public ContractProductStatus ProductStatus { get; set; }
    public decimal ProducedQuantity { get; set; }
    public DateTime ContractCreatedAt { get; set; }

    // Shu shartnoma mahsulotiga biriktirilgan hujjatlar va vazifalar.
    public List<ProductCatalogResourceDto> TechProcesses { get; set; } = [];  // Status = ProcessStatus
    public List<ProductCatalogResourceDto> Drawings { get; set; } = [];       // Status = DrawingStatus
    public List<ProductCatalogResourceDto> CostNorms { get; set; } = [];      // Status = DrawingStatus
    public List<ProductCatalogTaskDto> Tasks { get; set; } = [];
}

// Tex jarayon / chizma / me'yoriy sarf uchun umumiy yengil ko'rinish.
// Status ma'nosi manba turiga bog'liq (yuqoridagi izohlarga qarang).
public class ProductCatalogResourceDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Status { get; set; }
    // Qo'shimcha son: tex jarayonda — joriy bosqich, me'yoriy sarfda — material qatorlari soni.
    // Matnga aylantirish frontendda (tarjima qilinishi uchun). Chizmada — null.
    public int? MetaValue { get; set; }
}

public class ProductCatalogTaskDto
{
    public Guid Id { get; set; }
    public int OrderNo { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CompletedAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal Importance { get; set; }
}
