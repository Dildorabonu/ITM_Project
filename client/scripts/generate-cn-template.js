/* eslint-disable */
// Generates a sample me'yoriy sarf DOCX template that matches the
// techprocess parser (`parseMainTables` in app/techprocess/_types.ts).
// Run: node scripts/generate-cn-template.js
// Output: public/namuna_meyoriy_sarf.docx

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const xmlEscape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const headers = [
  "№ т/р",
  "Ҳом-ашё номи",
  "Ўлчов бирлиги",
  "Тайёр маҳсулот учун",
  "Ҳом-ашё чиқиндиси",
  "Умумий ҳом-ашё сарфи",
  "Импорт / Местный",
];

const sampleRows = [
  ["1", "Po'lat list 2 mm", "kg", "12.5", "0.8", "13.3", "Местный"],
  ["2", "Profil truba 40x40", "m", "3.0", "0.2", "3.2", "Импорт"],
  ["3", "Bolt M8x25", "dona", "10", "0", "10", "Местный"],
];

const cell = (text, opts = {}) => {
  const widthAttr = opts.width
    ? `<w:tcW w:w="${opts.width}" w:type="dxa"/>`
    : `<w:tcW w:w="0" w:type="auto"/>`;
  const colspan = opts.gridSpan
    ? `<w:gridSpan w:val="${opts.gridSpan}"/>`
    : "";
  const shading = opts.shade
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`
    : "";
  const bold = opts.bold ? "<w:rPr><w:b/></w:rPr>" : "";
  const align = opts.align
    ? `<w:pPr><w:jc w:val="${opts.align}"/></w:pPr>`
    : "";
  return `<w:tc>
    <w:tcPr>${widthAttr}${colspan}${shading}</w:tcPr>
    <w:p>${align}<w:r>${bold}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>
  </w:tc>`;
};

const headerRow = `<w:tr>
  <w:trPr><w:tblHeader/></w:trPr>
  ${headers
    .map((h) =>
      cell(h, { bold: true, align: "center", shade: "DCE6F2" })
    )
    .join("")}
</w:tr>`;

const dataRow = (cells) =>
  `<w:tr>${cells
    .map((c, i) =>
      cell(c, { align: i === 1 ? "left" : "center" })
    )
    .join("")}</w:tr>`;

const sectionRow = (text) =>
  `<w:tr>${cell(text, {
    bold: true,
    align: "left",
    gridSpan: headers.length,
    shade: "F2F2F2",
  })}</w:tr>`;

const tableXml = `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
    </w:tblBorders>
    <w:tblLayout w:type="autofit"/>
  </w:tblPr>
  <w:tblGrid>${headers.map(() => `<w:gridCol w:w="1300"/>`).join("")}</w:tblGrid>
  ${headerRow}
  ${sectionRow("Birinchi bo'lim — Asosiy materiallar")}
  ${sampleRows.map(dataRow).join("\n")}
</w:tbl>`;

const titlePara = (text, opts = {}) => `<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    ${opts.spacingAfter ? `<w:spacing w:after="${opts.spacingAfter}"/>` : ""}
  </w:pPr>
  <w:r>
    <w:rPr>${opts.bold ? "<w:b/>" : ""}${opts.size ? `<w:sz w:val="${opts.size}"/>` : ""}</w:rPr>
    <w:t xml:space="preserve">${xmlEscape(text)}</w:t>
  </w:r>
</w:p>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${titlePara("Me'yoriy sarf jadvali (namuna)", { bold: true, size: 28, spacingAfter: 120 })}
    ${titlePara("Ko'rsatma: ustunlar tartibi yoki nomi o'zgartirilmasin. Kerakli qatorlarni qo'shing va to'ldiring.", { size: 18, spacingAfter: 240 })}
    ${tableXml}
    <w:p>
      <w:pPr><w:spacing w:before="240"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Eslatma: kulrang qator — bo'lim sarlavhasi (ixtiyoriy). Oldidagi raqam ustuni «№ т/р» — ketma-ket raqam.</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

(async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml);
  zip.folder("_rels").file(".rels", rootRelsXml);
  zip.folder("word").file("document.xml", documentXml);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const outPath = path.resolve(__dirname, "..", "public", "namuna_meyoriy_sarf.docx");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote:", outPath, `(${buffer.length} bytes)`);
})();
