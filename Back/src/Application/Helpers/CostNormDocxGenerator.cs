using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Application.DTOs.CostNorms;
using Core.Entities;

namespace Application.Helpers;

// Generates a DOCX for a CostNorm modeled after client/public/namuna_meyoriy_sarf.docx.
// Layout: two header blocks (KELISHILGAN / TASDIQLAYMAN), title, 9-column main table
// with merged headers (Сарфланган хом-ашёлар миқдори spans 3, Фотосуратлар spans 2),
// note paragraph, and signature footer. Times New Roman throughout.
//
// Header column texts are tuned so the file still round-trips through
// client/app/techprocess/_types.ts parseMainTables(): test patterns for required
// columns (№, номи, лчов, тайёр, иқинди, мумий, импорт) and the optional photo
// columns (хом, ярим) all resolve to unique cells.
public static class CostNormDocxGenerator
{
    // 9-column grid widths (twips). Matches namuna proportions for a landscape A4.
    private static readonly int[] ColWidths =
    [
        537,   // 1. №
        3257,  // 2. Name
        709,   // 3. Unit
        1855,  // 4. Ready
        1724,  // 5. Waste
        1946,  // 6. Total
        2133,  // 7. PhotoRaw
        2191,  // 8. PhotoSemi
        1568,  // 9. ImportType
    ];

    public static byte[] Generate(CostNorm costNorm) => Generate(costNorm, null, null, null);

    public static byte[] Generate(CostNorm costNorm, Contract? contract, ContractProduct? product, CostNormMetadataDto? metadata = null)
    {
        var documentXml = BuildDocumentXml(costNorm, contract, product, metadata);

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddEntry(zip, "[Content_Types].xml", ContentTypesXml);
            AddEntry(zip, "_rels/.rels", RootRelsXml);
            AddEntry(zip, "word/_rels/document.xml.rels", DocumentRelsXml);
            AddEntry(zip, "word/styles.xml", StylesXml);
            AddEntry(zip, "word/document.xml", documentXml);
        }
        return ms.ToArray();
    }

    public static string BuildFileName(string title)
    {
        var safe = string.IsNullOrWhiteSpace(title) ? "meyoriy-sarf" : title.Trim();
        foreach (var c in Path.GetInvalidFileNameChars())
            safe = safe.Replace(c, '_');
        return $"{safe}.docx";
    }

    private static string BuildDocumentXml(CostNorm costNorm, Contract? contract, ContractProduct? product, CostNormMetadataDto? metadata)
    {
        var sb = new StringBuilder();
        sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
        sb.Append("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>");

        // Approval blocks: prefer metadata from the uploaded file; fall back to namuna defaults.
        var approvalLeft = metadata?.ApprovalLeft is { Count: > 0 } ? metadata.ApprovalLeft : DefaultApprovalLeft;
        var approvalRight = metadata?.ApprovalRight is { Count: > 0 } ? metadata.ApprovalRight : DefaultApprovalRight;

        sb.Append(BuildApprovalBlock(isLeft: true, lines: approvalLeft));
        sb.Append(BuildApprovalBlock(isLeft: false, lines: approvalRight));

        // Spacer paragraphs so the floating blocks don't overlap the title.
        sb.Append(EmptyPara());
        sb.Append(EmptyPara());
        sb.Append(EmptyPara());
        sb.Append(EmptyPara());
        sb.Append(EmptyPara());
        sb.Append(EmptyPara());

        // Title: "{title} сарфланган маҳсулотларнинг сарфи-меёр хужжати"
        var titleLead = BuildTitleLead(costNorm, contract, product);
        sb.Append(CenteredPara(
            $"{XmlEscape(titleLead)} сарфланган маҳсулотларнинг сарфи-меёр хужжати",
            bold: true, sizeHalfPt: 28, spacingAfter: 160));

        if (!string.IsNullOrWhiteSpace(costNorm.Notes))
            sb.Append(CenteredPara(XmlEscape(costNorm.Notes!), sizeHalfPt: 22, spacingAfter: 160));

        // Main 9-column table
        sb.Append(BuildMainTableOpen());
        sb.Append(BuildMainTableHeader());
        sb.Append(BuildMainTableBody(costNorm));
        sb.Append("</w:tbl>");

        // Note paragraph (from uploaded file, or default)
        var footerNote = string.IsNullOrWhiteSpace(metadata?.FooterNote) ? DefaultFooterNote : metadata!.FooterNote!;
        sb.Append(NotePara(footerNote));
        sb.Append(EmptyPara());

        // Signature footer
        sb.Append(BuildSignatureFooter(metadata?.Signatures));

        // Section properties (landscape A4 like namuna)
        sb.Append("<w:sectPr>");
        sb.Append("<w:pgSz w:w=\"16840\" w:h=\"11910\" w:orient=\"landscape\"/>");
        sb.Append("<w:pgMar w:top=\"1060\" w:right=\"420\" w:bottom=\"620\" w:left=\"440\" w:header=\"720\" w:footer=\"421\" w:gutter=\"0\"/>");
        sb.Append("</w:sectPr>");
        sb.Append("</w:body></w:document>");
        return sb.ToString();
    }

    private static string BuildTitleLead(CostNorm costNorm, Contract? contract, ContractProduct? product)
    {
        // Prefer product type → contract no → cost-norm title → fallback dashes.
        if (product is not null && !string.IsNullOrWhiteSpace(product.ProductType))
            return product.ProductType.Trim();
        if (contract is not null && !string.IsNullOrWhiteSpace(contract.ContractNo))
            return contract.ContractNo.Trim();
        if (!string.IsNullOrWhiteSpace(costNorm.Title))
            return costNorm.Title.Trim();
        return "_______________";
    }

    // Defaults pulled from the namuna template — used when the uploaded file
    // didn't include these blocks (e.g. legacy uploads or stripped templates).
    private static readonly List<string> DefaultApprovalLeft =
    [
        "«KELISHILGAN»",
        "«INNOVATSIYA TEXNOLOGIYALARI MARKAZI» MChJ",
        "BOSH DIREKTOR O‘RINBOSARI-",
        "BOSH MUHANDIS",
        "_______________",
        "«_____» __________ 20    y.",
    ];

    private static readonly List<string> DefaultApprovalRight =
    [
        "«TASDIQLAYMAN»",
        "«INNOVATSIYA TEXNOLOGIYALARI MARKAZI» MChJ",
        "BOSH DIREKTORI",
        "_______________",
        "«_____» __________ 20    y.",
    ];

    private const string DefaultFooterNote =
        "Изоҳ: «Ўлчов бирлиги» устуни учун қуйидаги қийматлардан фойдаланинг: " +
        "дона, кг, г, л, м, кв.м, куб.м, қути, пакет, тўплам.";

    private static readonly List<SignatureLineDto> DefaultSignatures =
    [
        new() { Title = "Начальник отдел конструкторского и технологии – Главный конструктор", Name = "А. Мамаражабов" },
        new() { Title = "Начальник опытно-испытательного и производственного цеха – главный специалист", Name = "М. Захидов" },
        new() { Title = "Началник цеха", Name = "А. Соипов" },
        new() { Title = "Технолог", Name = "Савриев Ф" },
        new() { Title = "Конструктор", Name = "Абдурахмонов А" },
    ];

    // Floating signature block, positioned to the left or right of the page header area.
    // The first line is rendered as the centered heading; remaining lines flow below.
    private static string BuildApprovalBlock(bool isLeft, IReadOnlyList<string> lines)
    {
        var sb = new StringBuilder();
        sb.Append("<w:tbl>");
        sb.Append("<w:tblPr>");
        if (isLeft)
            sb.Append("<w:tblpPr w:leftFromText=\"180\" w:rightFromText=\"180\" w:horzAnchor=\"margin\" w:tblpY=\"-238\"/>");
        else
            sb.Append("<w:tblpPr w:leftFromText=\"180\" w:rightFromText=\"180\" w:vertAnchor=\"text\" w:horzAnchor=\"margin\" w:tblpXSpec=\"right\" w:tblpY=\"-80\"/>");
        sb.Append("<w:tblW w:w=\"0\" w:type=\"auto\"/>");
        sb.Append("<w:tblBorders>");
        sb.Append("<w:top w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:left w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:bottom w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:right w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:insideH w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:insideV w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("</w:tblBorders>");
        sb.Append("</w:tblPr>");

        var colW = isLeft ? 6502 : 6204;
        sb.Append("<w:tblGrid>");
        sb.Append($"<w:gridCol w:w=\"{colW}\"/>");
        sb.Append("</w:tblGrid>");

        foreach (var line in lines)
        {
            if (string.IsNullOrEmpty(line)) continue;
            sb.Append("<w:tr><w:tc>");
            sb.Append($"<w:tcPr><w:tcW w:w=\"{colW}\" w:type=\"dxa\"/></w:tcPr>");
            sb.Append(InlineRun(line, bold: true, sizeHalfPt: 22, align: "center"));
            sb.Append("</w:tc></w:tr>");
        }

        sb.Append("</w:tbl>");
        return sb.ToString();
    }

    private static string BuildMainTableOpen()
    {
        var totalW = 0;
        foreach (var w in ColWidths) totalW += w;

        var sb = new StringBuilder();
        sb.Append("<w:tbl>");
        sb.Append("<w:tblPr>");
        sb.Append($"<w:tblW w:w=\"{totalW}\" w:type=\"dxa\"/>");
        sb.Append("<w:jc w:val=\"center\"/>");
        sb.Append("<w:tblBorders>");
        sb.Append("<w:top w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("<w:left w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("<w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("<w:right w:val=\"single\" w:sz=\"6\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("<w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"000000\"/>");
        sb.Append("</w:tblBorders>");
        sb.Append("<w:tblLayout w:type=\"fixed\"/>");
        sb.Append("</w:tblPr>");

        sb.Append("<w:tblGrid>");
        foreach (var w in ColWidths) sb.Append($"<w:gridCol w:w=\"{w}\"/>");
        sb.Append("</w:tblGrid>");
        return sb.ToString();
    }

    private static string BuildMainTableHeader()
    {
        var sb = new StringBuilder();

        // Row 1 — outer header cells. Cells 1/2/3/9 start vertical merges; 4-6 and 7-8 are grouped.
        sb.Append("<w:tr><w:trPr><w:tblHeader/></w:trPr>");
        sb.Append(MergedHeaderCell("№ т/р", ColWidths[0], vMergeRestart: true));
        sb.Append(MergedHeaderCell("Ҳом-ашё номи (рус тилида)", ColWidths[1], vMergeRestart: true));
        sb.Append(MergedHeaderCell("Ўлчов бирлиги", ColWidths[2], vMergeRestart: true));
        sb.Append(MergedHeaderCell("Сарфланган хом-ашёлар миқдори", ColWidths[3] + ColWidths[4] + ColWidths[5], gridSpan: 3));
        sb.Append(MergedHeaderCell("Фотосуратлар", ColWidths[6] + ColWidths[7], gridSpan: 2));
        sb.Append(MergedHeaderCell("Импорт / Местный / Локализация", ColWidths[8], vMergeRestart: true));
        sb.Append("</w:tr>");

        // Row 2 — sub-header. vMerged columns continue; new sub-cells appear in the spanned groups.
        sb.Append("<w:tr><w:trPr><w:tblHeader/></w:trPr>");
        sb.Append(MergedHeaderCell(string.Empty, ColWidths[0], vMergeContinue: true));
        sb.Append(MergedHeaderCell(string.Empty, ColWidths[1], vMergeContinue: true));
        sb.Append(MergedHeaderCell(string.Empty, ColWidths[2], vMergeContinue: true));
        sb.Append(MergedHeaderCell("Тайёр маҳсулот", ColWidths[3]));
        sb.Append(MergedHeaderCell("Ҳом-ашё чиқиндиси", ColWidths[4]));
        sb.Append(MergedHeaderCell("Умумий ҳом-ашё сарфи", ColWidths[5]));
        sb.Append(MergedHeaderCell("Хом-ашё", ColWidths[6]));
        sb.Append(MergedHeaderCell("Ярим тайор маҳсулот", ColWidths[7]));
        sb.Append(MergedHeaderCell(string.Empty, ColWidths[8], vMergeContinue: true));
        sb.Append("</w:tr>");
        return sb.ToString();
    }

    private static string BuildMainTableBody(CostNorm costNorm)
    {
        var sb = new StringBuilder();
        var ordered = costNorm.Items.OrderBy(i => i.SortOrder).ToList();
        foreach (var item in ordered)
        {
            if (item.IsSection)
            {
                // Section rows: empty № cell + section-name cell spanning the remaining 8 columns.
                var spannedWidth = 0;
                for (var i = 1; i < ColWidths.Length; i++) spannedWidth += ColWidths[i];
                sb.Append("<w:tr>");
                sb.Append(BodyCell(string.Empty, ColWidths[0], align: "center"));
                sb.Append(BodyCell(item.SectionName ?? string.Empty,
                    spannedWidth, gridSpan: ColWidths.Length - 1,
                    bold: true, align: "center", sizeHalfPt: 28));
                sb.Append("</w:tr>");
                continue;
            }

            sb.Append("<w:tr>");
            sb.Append(BodyCell(item.No ?? string.Empty,         ColWidths[0], align: "center"));
            sb.Append(BodyCell(item.Name ?? string.Empty,       ColWidths[1], align: "left"));
            sb.Append(BodyCell(item.Unit ?? string.Empty,       ColWidths[2], align: "center"));
            sb.Append(BodyCell(item.ReadyQty ?? string.Empty,   ColWidths[3], align: "center"));
            sb.Append(BodyCell(item.WasteQty ?? string.Empty,   ColWidths[4], align: "center"));
            sb.Append(BodyCell(item.TotalQty ?? string.Empty,   ColWidths[5], align: "center"));
            sb.Append(BodyCell(string.Empty,                    ColWidths[6], align: "center"));
            sb.Append(BodyCell(string.Empty,                    ColWidths[7], align: "center"));
            sb.Append(BodyCell(item.ImportType ?? string.Empty, ColWidths[8], align: "center"));
            sb.Append("</w:tr>");
        }
        return sb.ToString();
    }

    private static string BuildSignatureFooter(IReadOnlyList<SignatureLineDto>? signatures)
    {
        // Prefer signatures from the user's uploaded file; fall back to namuna defaults
        // so legacy cost norms (created before metadata was captured) still render properly.
        var rows = signatures is { Count: > 0 } ? signatures : DefaultSignatures;

        var sb = new StringBuilder();
        sb.Append("<w:tbl>");
        sb.Append("<w:tblPr>");
        sb.Append("<w:tblW w:w=\"15920\" w:type=\"dxa\"/>");
        sb.Append("<w:tblBorders>");
        sb.Append("<w:top w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:left w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:bottom w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:right w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:insideH w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("<w:insideV w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>");
        sb.Append("</w:tblBorders>");
        sb.Append("</w:tblPr>");
        sb.Append("<w:tblGrid>");
        sb.Append("<w:gridCol w:w=\"9000\"/>");
        sb.Append("<w:gridCol w:w=\"2500\"/>");
        sb.Append("<w:gridCol w:w=\"4420\"/>");
        sb.Append("</w:tblGrid>");

        foreach (var sig in rows)
        {
            if (string.IsNullOrWhiteSpace(sig.Title) && string.IsNullOrWhiteSpace(sig.Name)) continue;
            sb.Append("<w:tr>");
            sb.Append("<w:tc>");
            // Har bir imzo qatoridan keyin bitta bo'sh qator qolsin (spacingAfter),
            // lavozim va ismlar qalin emas.
            sb.Append("<w:tcPr><w:tcW w:w=\"9000\" w:type=\"dxa\"/></w:tcPr>");
            sb.Append(InlineRun(sig.Title ?? string.Empty, sizeHalfPt: 28, align: "left", spacingAfter: 280));
            sb.Append("</w:tc>");
            sb.Append("<w:tc>");
            sb.Append("<w:tcPr><w:tcW w:w=\"2500\" w:type=\"dxa\"/></w:tcPr>");
            sb.Append(InlineRun(string.Empty, sizeHalfPt: 28, align: "center", spacingAfter: 280));
            sb.Append("</w:tc>");
            sb.Append("<w:tc>");
            sb.Append("<w:tcPr><w:tcW w:w=\"4420\" w:type=\"dxa\"/></w:tcPr>");
            sb.Append(InlineRun(sig.Name ?? string.Empty, sizeHalfPt: 28, align: "left", spacingAfter: 280));
            sb.Append("</w:tc>");
            sb.Append("</w:tr>");
        }

        sb.Append("</w:tbl>");
        return sb.ToString();
    }

    private static string MergedHeaderCell(string text, int width,
        int? gridSpan = null, bool vMergeRestart = false, bool vMergeContinue = false)
    {
        var sb = new StringBuilder();
        sb.Append("<w:tc><w:tcPr>");
        sb.Append($"<w:tcW w:w=\"{width}\" w:type=\"dxa\"/>");
        if (gridSpan.HasValue) sb.Append($"<w:gridSpan w:val=\"{gridSpan.Value}\"/>");
        if (vMergeRestart) sb.Append("<w:vMerge w:val=\"restart\"/>");
        else if (vMergeContinue) sb.Append("<w:vMerge/>");
        sb.Append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"DCE6F2\"/>");
        sb.Append("<w:vAlign w:val=\"center\"/>");
        sb.Append("</w:tcPr>");
        sb.Append(InlineRun(text, bold: true, sizeHalfPt: 24, align: "center"));
        sb.Append("</w:tc>");
        return sb.ToString();
    }

    private static string BodyCell(string text, int width,
        int? gridSpan = null, bool bold = false, string align = "left", int sizeHalfPt = 24)
    {
        var sb = new StringBuilder();
        sb.Append("<w:tc><w:tcPr>");
        sb.Append($"<w:tcW w:w=\"{width}\" w:type=\"dxa\"/>");
        if (gridSpan.HasValue) sb.Append($"<w:gridSpan w:val=\"{gridSpan.Value}\"/>");
        sb.Append("<w:vAlign w:val=\"center\"/>");
        sb.Append("</w:tcPr>");
        sb.Append(InlineRun(text, bold: bold, sizeHalfPt: sizeHalfPt, align: align));
        sb.Append("</w:tc>");
        return sb.ToString();
    }

    // Builds a paragraph containing a single text run with Times New Roman + formatting.
    private static string InlineRun(string text, bool bold = false, int sizeHalfPt = 22, string? align = null, int? spacingAfter = null)
    {
        var alignXml = align is null ? string.Empty : $"<w:jc w:val=\"{align}\"/>";
        if (spacingAfter.HasValue) alignXml = $"<w:spacing w:after=\"{spacingAfter.Value}\"/>" + alignXml;
        var rprXml = new StringBuilder();
        rprXml.Append("<w:rPr>");
        rprXml.Append("<w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>");
        if (bold) rprXml.Append("<w:b/><w:bCs/>");
        rprXml.Append($"<w:sz w:val=\"{sizeHalfPt}\"/><w:szCs w:val=\"{sizeHalfPt}\"/>");
        rprXml.Append("</w:rPr>");

        var safe = XmlEscape(text ?? string.Empty);
        return $"<w:p><w:pPr>{alignXml}<w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/></w:rPr></w:pPr>" +
               $"<w:r>{rprXml}<w:t xml:space=\"preserve\">{safe}</w:t></w:r></w:p>";
    }

    private static string CenteredPara(string text, bool bold = false, int sizeHalfPt = 22, int? spacingAfter = null)
    {
        var spacing = spacingAfter.HasValue ? $"<w:spacing w:after=\"{spacingAfter.Value}\"/>" : string.Empty;
        var rpr = new StringBuilder();
        rpr.Append("<w:rPr>");
        rpr.Append("<w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>");
        if (bold) rpr.Append("<w:b/><w:bCs/>");
        rpr.Append($"<w:sz w:val=\"{sizeHalfPt}\"/><w:szCs w:val=\"{sizeHalfPt}\"/>");
        rpr.Append("</w:rPr>");
        return $"<w:p><w:pPr><w:jc w:val=\"center\"/>{spacing}</w:pPr><w:r>{rpr}<w:t xml:space=\"preserve\">{text}</w:t></w:r></w:p>";
    }

    private static string NotePara(string text)
    {
        var rpr = "<w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/><w:i/><w:sz w:val=\"20\"/><w:szCs w:val=\"20\"/></w:rPr>";
        return $"<w:p><w:pPr><w:spacing w:before=\"160\" w:after=\"160\"/></w:pPr><w:r>{rpr}<w:t xml:space=\"preserve\">{XmlEscape(text)}</w:t></w:r></w:p>";
    }

    private static string EmptyPara()
    {
        return "<w:p><w:pPr><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/></w:rPr></w:pPr></w:p>";
    }

    private static string XmlEscape(string value)
    {
        return value
            .Replace("&", "&amp;")
            .Replace("<", "&lt;")
            .Replace(">", "&gt;")
            .Replace("\"", "&quot;")
            .Replace("'", "&apos;");
    }

    private static void AddEntry(ZipArchive zip, string path, string content)
    {
        var entry = zip.CreateEntry(path, CompressionLevel.Optimal);
        using var stream = entry.Open();
        var bytes = Encoding.UTF8.GetBytes(content);
        stream.Write(bytes, 0, bytes.Length);
    }

    private const string ContentTypesXml =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
        "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>" +
        "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>" +
        "</Types>";

    private const string RootRelsXml =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>" +
        "</Relationships>";

    private const string DocumentRelsXml =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
        "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
        "</Relationships>";

    // Minimal styles.xml with Times New Roman as the default font so cells without
    // explicit rFonts still render correctly in Word/LibreOffice.
    private const string StylesXml =
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">" +
        "<w:docDefaults>" +
        "<w:rPrDefault><w:rPr>" +
        "<w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>" +
        "<w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/>" +
        "<w:lang w:val=\"uz-Cyrl-UZ\" w:eastAsia=\"ru-RU\"/>" +
        "</w:rPr></w:rPrDefault>" +
        "<w:pPrDefault><w:pPr><w:spacing w:after=\"0\" w:line=\"240\" w:lineRule=\"auto\"/></w:pPr></w:pPrDefault>" +
        "</w:docDefaults>" +
        "</w:styles>";
}
