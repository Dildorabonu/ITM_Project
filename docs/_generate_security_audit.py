"""
E-Korxona xavfsizlik auditi DOCX generatori.

Bu skript `SECURITY_AUDIT.docx` faylini yaratadi — OWASP Top 10 (2021) bo'yicha
loyiha mosligi va kamchiliklarni bartaraf etish bo'yicha qadamma-qadam vazifalar.

Foydalanish:
    python docs/_generate_security_audit.py
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Cm, Pt, RGBColor


# ----- Ranglar (loyiha accent rangiga yaqin) -----
COLOR_PRIMARY = RGBColor(0x1A, 0x6E, 0xEB)
COLOR_TEXT = RGBColor(0x22, 0x2A, 0x33)
COLOR_MUTED = RGBColor(0x6B, 0x73, 0x80)
COLOR_DANGER = RGBColor(0xC0, 0x39, 0x2B)
COLOR_WARN = RGBColor(0xC2, 0x82, 0x16)
COLOR_SUCCESS = RGBColor(0x2E, 0x8B, 0x57)
COLOR_BG_HEADER = "1A6EEB"
COLOR_BG_ROW_ALT = "F2F5FA"


def set_cell_bg(cell, hex_color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def set_cell_borders(cell, color: str = "D0D7DE") -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:color"), color)
        tc_borders.append(b)
    tc_pr.append(tc_borders)


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = "Calibri"
        if level == 0:
            run.font.size = Pt(28)
            run.font.color.rgb = COLOR_PRIMARY
        elif level == 1:
            run.font.size = Pt(18)
            run.font.color.rgb = COLOR_PRIMARY
        elif level == 2:
            run.font.size = Pt(14)
            run.font.color.rgb = COLOR_TEXT
        else:
            run.font.size = Pt(12)
            run.font.color.rgb = COLOR_TEXT


def add_paragraph(doc: Document, text: str, bold: bool = False, italic: bool = False,
                  size: int = 11, color: RGBColor = COLOR_TEXT) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.bold = bold
    run.italic = italic


def add_bullet(doc: Document, text: str, level: int = 0) -> None:
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Cm(0.6 + level * 0.5)
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(10.5)
    run.font.color.rgb = COLOR_TEXT


def add_numbered(doc: Document, text: str) -> None:
    p = doc.add_paragraph(style="List Number")
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(10.5)
    run.font.color.rgb = COLOR_TEXT


def add_code_block(doc: Document, code: str, lang: str = "") -> None:
    if lang:
        meta = doc.add_paragraph()
        m_run = meta.add_run(lang)
        m_run.font.name = "Consolas"
        m_run.font.size = Pt(8.5)
        m_run.font.color.rgb = COLOR_MUTED
        m_run.italic = True

    p = doc.add_paragraph()
    p_pr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), "F6F8FA")
    p_pr.append(shd)

    p.paragraph_format.left_indent = Cm(0.3)
    p.paragraph_format.right_indent = Cm(0.3)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)

    for i, line in enumerate(code.split("\n")):
        if i > 0:
            p.add_run().add_break()
        run = p.add_run(line)
        run.font.name = "Consolas"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(0x24, 0x29, 0x2F)


def add_severity_badge(paragraph, label: str) -> None:
    color_map = {
        "KRITIK": COLOR_DANGER,
        "YUQORI": COLOR_DANGER,
        "O'RTA": COLOR_WARN,
        "ORTA": COLOR_WARN,
        "PAST": COLOR_SUCCESS,
        "YAXSHI": COLOR_SUCCESS,
    }
    run = paragraph.add_run(f"  [{label}]  ")
    run.bold = True
    run.font.name = "Calibri"
    run.font.size = Pt(10)
    run.font.color.rgb = color_map.get(label, COLOR_TEXT)


def add_kv_table(doc: Document, rows: list[tuple[str, str]]) -> None:
    table = doc.add_table(rows=len(rows), cols=2)
    table.autofit = False
    for i, (k, v) in enumerate(rows):
        c1, c2 = table.rows[i].cells
        c1.width = Cm(4.5)
        c2.width = Cm(11.5)
        for cell, text, bold in ((c1, k, True), (c2, v, False)):
            cell.paragraphs[0].text = ""
            run = cell.paragraphs[0].add_run(text)
            run.font.name = "Calibri"
            run.font.size = Pt(10.5)
            run.bold = bold
            run.font.color.rgb = COLOR_TEXT
            set_cell_borders(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if i % 2 == 0:
            set_cell_bg(c1, COLOR_BG_ROW_ALT)


def add_scorecard_table(doc: Document, rows: list[tuple[str, str, str, str]]) -> None:
    table = doc.add_table(rows=len(rows) + 1, cols=4)
    table.autofit = False
    headers = ("Kategoriya", "Holat", "Ball", "Asosiy topilma")
    widths = (Cm(4.5), Cm(2.5), Cm(1.5), Cm(8.0))

    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.width = widths[i]
        cell.paragraphs[0].text = ""
        run = cell.paragraphs[0].add_run(h)
        run.font.name = "Calibri"
        run.font.size = Pt(10.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_bg(cell, COLOR_BG_HEADER)
        set_cell_borders(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

    for ridx, (cat, status, score, note) in enumerate(rows, start=1):
        cells = table.rows[ridx].cells
        for cidx, (val, bold) in enumerate(((cat, True), (status, False), (score, True), (note, False))):
            cell = cells[cidx]
            cell.width = widths[cidx]
            cell.paragraphs[0].text = ""
            run = cell.paragraphs[0].add_run(val)
            run.font.name = "Calibri"
            run.font.size = Pt(10)
            run.bold = bold
            if cidx == 1:
                if status.startswith("Kritik") or status.startswith("Yuqori"):
                    run.font.color.rgb = COLOR_DANGER
                elif status.startswith("O'rta") or status.startswith("Orta"):
                    run.font.color.rgb = COLOR_WARN
                else:
                    run.font.color.rgb = COLOR_SUCCESS
            else:
                run.font.color.rgb = COLOR_TEXT
            set_cell_borders(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if ridx % 2 == 0:
            for c in cells:
                set_cell_bg(c, COLOR_BG_ROW_ALT)


def add_task_block(doc: Document, num: str, title: str, severity: str,
                   estimate: str, owner: str, steps: list[str],
                   code_blocks: list[tuple[str, str]] | None = None,
                   acceptance: list[str] | None = None,
                   notes: list[str] | None = None) -> None:
    """Bitta vazifa blokini chiqaradi."""
    add_heading(doc, f"Vazifa {num}: {title}", level=3)

    meta = doc.add_paragraph()
    add_severity_badge(meta, severity)
    r = meta.add_run(f"  Vaqt baholash: {estimate}    Mas'ul: {owner}")
    r.font.name = "Calibri"
    r.font.size = Pt(10)
    r.font.color.rgb = COLOR_MUTED
    r.italic = True

    add_paragraph(doc, "Qadamlar:", bold=True, size=10.5)
    for step in steps:
        add_numbered(doc, step)

    if code_blocks:
        for lang, code in code_blocks:
            add_code_block(doc, code, lang=lang)

    if acceptance:
        add_paragraph(doc, "Tekshirish mezonlari:", bold=True, size=10.5)
        for a in acceptance:
            add_bullet(doc, a)

    if notes:
        add_paragraph(doc, "Eslatmalar (offline/intranet kontekst):",
                      bold=True, italic=True, size=10, color=COLOR_MUTED)
        for n in notes:
            add_bullet(doc, n)


# ============================================================================
# HUJJATNI YARATISH
# ============================================================================

doc = Document()

# Sahifa hoshiyalarini sozlash
for section in doc.sections:
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)

# Default shrift
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

# ---------------------------------------------------------------------------
# Sarlavha sahifasi
# ---------------------------------------------------------------------------
title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_run = title_p.add_run("E-KORXONA")
title_run.font.name = "Calibri"
title_run.font.size = Pt(36)
title_run.bold = True
title_run.font.color.rgb = COLOR_PRIMARY

sub_p = doc.add_paragraph()
sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub_run = sub_p.add_run("RAQAMLI KORXONA PLATFORMASI")
sub_run.font.name = "Calibri"
sub_run.font.size = Pt(12)
sub_run.font.color.rgb = COLOR_MUTED
sub_run.italic = True

doc.add_paragraph()

main_title = doc.add_paragraph()
main_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
mt_run = main_title.add_run("XAVFSIZLIK AUDITI HISOBOTI")
mt_run.font.name = "Calibri"
mt_run.font.size = Pt(22)
mt_run.bold = True
mt_run.font.color.rgb = COLOR_TEXT

sub2 = doc.add_paragraph()
sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
s2 = sub2.add_run("OWASP Top 10 (2021) bo'yicha mosligi va bartaraf etish rejasi")
s2.font.name = "Calibri"
s2.font.size = Pt(13)
s2.font.color.rgb = COLOR_MUTED

doc.add_paragraph()
doc.add_paragraph()

today = date.today().strftime("%Y-%m-%d")
info_table = doc.add_table(rows=4, cols=2)
info_table.alignment = WD_ALIGN_PARAGRAPH.CENTER
info_rows = [
    ("Hujjat versiyasi", "1.0"),
    ("Tayyorlangan sana", today),
    ("Audit doirasi", "Backend (.NET 8) + Frontend (Next.js 16)"),
    ("Deploy muhiti", "Korxona ichki tarmog'i (intranet, internetga ulanish yo'q)"),
]
for i, (k, v) in enumerate(info_rows):
    c1, c2 = info_table.rows[i].cells
    c1.width = Cm(5.0)
    c2.width = Cm(9.0)
    for cell, text, bold in ((c1, k, True), (c2, v, False)):
        cell.paragraphs[0].text = ""
        run = cell.paragraphs[0].add_run(text)
        run.font.name = "Calibri"
        run.font.size = Pt(11)
        run.bold = bold
        run.font.color.rgb = COLOR_TEXT
        set_cell_borders(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

doc.add_page_break()

# ---------------------------------------------------------------------------
# 1. KIRISH
# ---------------------------------------------------------------------------
add_heading(doc, "1. Kirish", level=1)

add_heading(doc, "1.1. Hujjat maqsadi", level=2)
add_paragraph(doc,
    "Ushbu hujjat E-Korxona (ITM Factory) platformasining xavfsizlik holatini "
    "OWASP Top 10 (2021) standarti bo'yicha baholaydi. Hujjat ikki qismdan iborat:")
add_bullet(doc, "Har bir kategoriya bo'yicha hozirgi holat va topilgan kamchiliklar")
add_bullet(doc, "Aniqlangan muammolarni bartaraf etish bo'yicha sprintlarga taqsimlangan, qadamma-qadam vazifalar")

add_heading(doc, "1.2. Deploy muhiti haqida muhim eslatma", level=2)
add_paragraph(doc,
    "Tizim korxonaning ichki tarmog'ida (intranet) ishlaydi va internetga ulanish "
    "imkoniyati yo'q. Bu quyidagi xavfsizlik qarorlariga ta'sir qiladi:", bold=False)
add_bullet(doc, "Tashqi CDN, Let's Encrypt va boshqa internet xizmatlaridan foydalanib bo'lmaydi. "
                "SSL sertifikatlar ichki CA orqali yoki self-signed bo'lishi kerak.")
add_bullet(doc, "NPM, NuGet paketlari va Docker imijlari deploy oldidan ichki mirror serverga "
                "tayyorlab qo'yiladi (Verdaccio / Nexus / private NuGet feed).")
add_bullet(doc, "Logging va monitoring tashqi xizmatlarsiz, ichki ELK/Grafana yoki shunga o'xshash "
                "lokal yechimlar orqali tashkil qilinadi.")
add_bullet(doc, "Tashqi tahdid yuzasi (attack surface) sezilarli darajada kichik. Asosiy xavf — "
                "ichki foydalanuvchilar (insider threats), zararli USB qurilmalar, lokal tarmoqdagi "
                "MITM hujumlari va social engineering.")

add_heading(doc, "1.3. Audit metodologiyasi", level=2)
add_paragraph(doc,
    "Audit OWASP Top 10 (2021) standarti asosida o'tkazildi. Backend (.NET 8 Clean Architecture) "
    "va frontend (Next.js 16 + React 19) kodlari avtomatlashtirilgan tahlil hamda qo'lda ko'rib "
    "chiqish (manual review) usullari bilan baholandi.")

doc.add_page_break()

# ---------------------------------------------------------------------------
# 2. UMUMIY SCORECARD
# ---------------------------------------------------------------------------
add_heading(doc, "2. Umumiy baholash (Scorecard)", level=1)

add_paragraph(doc, "Umumiy ball: 6/10 — O'rta darajadagi xavfsizlik. Ba'zi kritik kamchiliklar mavjud "
                   "bo'lib, ular bartaraf etilgandan keyin ball 8.5/10 ga ko'tariladi.", bold=True)

doc.add_paragraph()

scorecard = [
    ("A01: Broken Access Control", "O'rta", "7/10",
     "Backend permission tizimi to'g'ri, frontend faqat UI ni yashiradi"),
    ("A02: Cryptographic Failures", "Kritik", "3/10",
     "Maxfiy ma'lumotlar appsettings.json da, HTTP ishlatilmoqda"),
    ("A03: Injection", "Yaxshi", "9/10",
     "EF Core parametrlash, fayl nomi sanitizatsiya"),
    ("A04: Insecure Design", "O'rta", "6/10",
     "Rate limiting yo'q, login lockout yo'q"),
    ("A05: Security Misconfiguration", "O'rta", "6/10",
     "CSP headers yo'q, global exception handler yo'q"),
    ("A06: Vulnerable Components", "O'rta", "6/10",
     "Dependency audit muntazam o'tkazilmagan"),
    ("A07: Auth & Session Failures", "Yaxshi", "8/10",
     "Refresh token rotation + reuse detection mavjud"),
    ("A08: Data Integrity Failures", "Yaxshi", "9/10",
     "Xavfli deserializatsiya yo'q"),
    ("A09: Logging & Monitoring", "Yuqori", "4/10",
     "Login fail va permission denied loglanmaydi"),
    ("A10: SSRF", "Yaxshi", "10/10",
     "Foydalanuvchi-boshqaruvchi tashqi URL yo'q"),
]
add_scorecard_table(doc, scorecard)

doc.add_page_break()

# ---------------------------------------------------------------------------
# 3. BATAFSIL TAHLIL
# ---------------------------------------------------------------------------
add_heading(doc, "3. Kategoriya bo'yicha batafsil tahlil", level=1)

# ----- A01 -----
add_heading(doc, "A01: Broken Access Control", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Backendda HasPermissionAttribute → PermissionAuthorizationHandler "
                "(Back/src/API/Authorization/) to'g'ri implementatsiya qilingan.")
add_bullet(doc, "ContractService.cs va CostNormService.cs da resurs darajasidagi ownership "
                "tekshiruvi mavjud (ContractUsers, ProductUsers, DepartmentId orqali).")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "Frontend faqat UI ni yashiradi (app/layout.tsx:213-221). Foydalanuvchi URL ni "
                "to'g'ridan-to'g'ri kiritib, himoyalanmagan API ga so'rov yuborishi mumkin.")
add_bullet(doc, "Backendda barcha controller endpointlarida [HasPermission] borligi ta'minlanmagan. "
                "Yangi endpointlar qo'shilganda unutib qo'yish xavfi mavjud.")
add_bullet(doc, "UserController.cs da ba'zi GET endpointlar har qanday autentifikatsiyalangan "
                "foydalanuvchiga ochiq.")

# ----- A02 -----
add_heading(doc, "A02: Cryptographic Failures", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "KRITIK")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Parollar BCrypt bilan to'g'ri xeshlanadi (PasswordHelper.cs).")
add_bullet(doc, "JWT validation parametrlari to'liq sozlangan (Program.cs:44-55).")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "DB paroli (2206) appsettings.Development.json:3 da ochiq matn ko'rinishida git "
                "history ga commit qilingan.")
add_bullet(doc, "JWT SecretKey placeholder appsettings.json:16 da ochiq turibdi.")
add_bullet(doc, "Production muhitda HTTPS ishlatilmaydi (intranet bo'lsa ham, lokal MITM xavfi bor).")
add_bullet(doc, "client/.env.local da NEXT_PUBLIC_API_URL=http://... — barcha tokenlar va PII "
                "ma'lumotlar oddiy matn ko'rinishida tarmoqda uzatiladi.")

# ----- A03 -----
add_heading(doc, "A03: Injection", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "YAXSHI")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "EF Core parametrlash to'liq ishlatiladi. FromSqlRaw yoki string konkatenatsiyali "
                "SQL topilmadi.")
add_bullet(doc, "Fayl nomlari AttachmentService.cs:158 da Path.GetFileName() orqali sanitizatsiya "
                "qilinadi — directory traversal himoyasi mavjud.")
add_bullet(doc, "Process.Start, LDAP, OS command injection vektorlari yo'q.")
add_bullet(doc, "Frontendda dangerouslySetInnerHTML, eval, new Function() ishlatilmagan.")

# ----- A04 -----
add_heading(doc, "A04: Insecure Design", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Parol murakkabligi qoidalari yaxshi: 8+ char, upper/lower/digit/special "
                "(UserService.cs:87-92).")
add_bullet(doc, "Refresh token rotation + reuse detection (commit 48e43d8) — kuchli himoya.")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "Rate limiting yo'q. /login va /refresh endpointlariga brute-force hujumi mumkin.")
add_bullet(doc, "Account lockout mexanizmi yo'q. Cheksiz urinish mumkin.")
add_bullet(doc, "CAPTCHA yoki shunga o'xshash bot himoyasi yo'q.")

# ----- A05 -----
add_heading(doc, "A05: Security Misconfiguration", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "CORS to'g'ri sozlangan — faqat localhost va RFC1918 IP lar (Program.cs:76-86).")
add_bullet(doc, "Swagger faqat Development da ochiq (Program.cs:128-132).")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "Global exception handler yo'q. Production xatoliklari stack trace ni oshkor qilishi mumkin.")
add_bullet(doc, "Frontend uchun next.config.ts da Content-Security-Policy, X-Frame-Options, "
                "X-Content-Type-Options headerlar sozlanmagan.")
add_bullet(doc, "Hujjat upload endpointlarida (ContractController, CostNormController) MIME type "
                "whitelist yo'q. Executable fayllar yuklash mumkin.")

# ----- A06 -----
add_heading(doc, "A06: Vulnerable and Outdated Components", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "O'RTA")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "npm audit va dotnet list package --vulnerable muntazam o'tkazilmagan.")
add_bullet(doc, "html2pdf.js (0.14.0) va mammoth (1.12.0) paketlari uzoq vaqtdan beri "
                "yangilanmagan (oxirgi update 2020).")
add_bullet(doc, "Dependabot yoki ekvivalent avtomatik update tizimi mavjud emas.")

# ----- A07 -----
add_heading(doc, "A07: Authentication & Session Failures", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "YAXSHI")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "JWT validation to'liq: ValidateIssuer, ValidateAudience, ValidateLifetime, "
                "ClockSkew=Zero (Program.cs:44-55).")
add_bullet(doc, "Token muddati 30 daqiqa — maqbul.")
add_bullet(doc, "Refresh token rotation + family-based reuse detection (AuthService.cs:62-66).")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "Tokenlar localStorage da saqlanadi (authStore.ts) — XSS xavfi.")
add_bullet(doc, "Login muvaffaqiyatsizlik soni cheklanmagan.")

# ----- A08 -----
add_heading(doc, "A08: Software & Data Integrity Failures", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "YAXSHI")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "JsonSerializer xavfli TypeNameHandling sozlamalarisiz ishlatiladi.")
add_bullet(doc, "Foydalanuvchidan kelgan ma'lumot strict tipdagi DTO larga deserialize qilinadi.")

# ----- A09 -----
add_heading(doc, "A09: Security Logging & Monitoring Failures", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "YUQORI")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Biznes hodisalar (kontrakt, shipment, task-log) ActivityLogService da loglanadi.")
add_paragraph(doc, "Topilgan kamchiliklar:", bold=True)
add_bullet(doc, "Login muvaffaqiyatsizliklari, IP, user-agent, sana — loglanmaydi.")
add_bullet(doc, "Permission denied hodisalari loglanmaydi.")
add_bullet(doc, "Token revoke va refresh hodisalari audit trail ga tushmaydi.")
add_bullet(doc, "Markazlashtirilgan log aggregation (ELK, Loki) sozlanmagan.")
add_bullet(doc, "Anomaliya bo'lganda ogohlantirish (alerting) tizimi yo'q.")

# ----- A10 -----
add_heading(doc, "A10: Server-Side Request Forgery", level=2)
para = doc.add_paragraph()
add_severity_badge(para, "YAXSHI")
add_paragraph(doc, "Foydalanuvchi tomonidan boshqariladigan URL ga HttpClient so'rovlari topilmadi. "
                   "PDF generatsiyasida resolvePhoto() blob/data/https sxemalarini tekshiradi.")

doc.add_page_break()

# ---------------------------------------------------------------------------
# 4. QADAMMA-QADAM VAZIFALAR
# ---------------------------------------------------------------------------
add_heading(doc, "4. Kamchiliklarni bartaraf etish rejasi", level=1)
add_paragraph(doc,
    "Vazifalar 3 ta sprintga taqsimlangan: KRITIK (1-2 hafta), YUQORI (3-4 hafta), "
    "O'RTA (1-2 oy). Har bir vazifa uchun: qadamlar, kod namunalari, "
    "tekshirish mezonlari va intranet kontekstidagi maslahatlar berilgan.")

# ============================================================================
# SPRINT 1: KRITIK
# ============================================================================
add_heading(doc, "4.1. Sprint 1 — KRITIK vazifalar (1-2 hafta)", level=2)

# ----- Task 1.1 -----
add_task_block(
    doc, "1.1",
    "Maxfiy ma'lumotlarni appsettings dan olib tashlash",
    "KRITIK", "1 kun", "Backend dasturchi + DevOps",
    steps=[
        "Back/src/API/ papkasida `dotnet user-secrets init` buyrug'ini ishga tushiring.",
        "DB connection string ni user-secrets ga ko'chiring: `dotnet user-secrets set "
        "\"ConnectionStrings:DefaultConnection\" \"Host=...;Database=...;Username=...;Password=...\"`",
        "JWT SecretKey ni user-secrets ga ko'chiring: `dotnet user-secrets set "
        "\"Jwt:SecretKey\" \"<256-bit-random-key>\"`",
        "appsettings.json va appsettings.Development.json dan barcha maxfiy qiymatlarni olib "
        "tashlang. Faqat placeholder yoki bo'sh string qoldiring.",
        "Production deploy uchun environment variable lar orqali yoki ichki Secrets vault "
        "(masalan, HashiCorp Vault Community Edition lokal versiyasi yoki oddiy shifrlangan "
        ".env fayl tarmoqda himoyalangan papkada) orqali oling.",
        "Git history dan eski maxfiy ma'lumotlarni tozalash: `git filter-repo --invert-paths "
        "--path Back/src/API/appsettings.Development.json` (BACKUP qiling avval!).",
        "Eski parollar va kalitlarni o'zgartiring — ular ifsho qilingan deb hisoblang.",
    ],
    code_blocks=[
        ("PowerShell", "cd Back\\src\\API\ndotnet user-secrets init\ndotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\"\ndotnet user-secrets set \"Jwt:SecretKey\" \"<random-256-bit-key>\""),
        ("256-bit kalit generatsiya (PowerShell)",
         "$bytes = New-Object byte[] 32\n[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)\n[Convert]::ToBase64String($bytes)"),
    ],
    acceptance=[
        "appsettings.*.json fayllarida hech qanday maxfiy qiymat yo'q",
        ".gitignore ga `**/appsettings.Production.json` qo'shilgan",
        "Loyiha lokal va production muhitlarda muvaffaqiyatli ishga tushadi",
        "Git history da eski parollar yo'q (BFG yoki git filter-repo orqali tozalangan)",
    ],
    notes=[
        "Intranetda HashiCorp Vault o'rniga oddiyroq yechim — Windows DPAPI orqali shifrlangan "
        ".env fayl yoki Active Directory bilan integratsiyalashgan parol saqlash xizmati.",
    ],
)

# ----- Task 1.2 -----
add_task_block(
    doc, "1.2",
    "Hujjat upload endpointlariga MIME type whitelist qo'shish",
    "KRITIK", "2-3 kun", "Backend dasturchi",
    steps=[
        "AttachmentService.cs da yagona validatsiya metodi yarating: ValidateFileUpload(IFormFile file).",
        "Whitelist ni konfiguratsiya qiling (appsettings.json yoki const):"
        " allowed extensions = .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .jpg, .jpeg, .png, .webp, .txt.",
        "Magic bytes (file signature) ni tekshiring — faqat Content-Type ga ishonish xavfli.",
        "Maksimal hajm 50 MB ni saqlang, lekin har bir endpoint uchun aniqlash mumkinligini qoldiring.",
        "ContractController, CostNormController, RequisitionController, TechnicalDrawingController, "
        "TechProcessController larda ValidateFileUpload chaqiruvini qo'shing.",
        "Yuklangan fayllarni o'rganish (preview/download) endpointlarida ham Content-Type "
        "headerini qat'iy sozlang (X-Content-Type-Options: nosniff).",
    ],
    code_blocks=[
        ("Back/src/Application/Helpers/FileValidator.cs (yangi fayl)",
         "public static class FileValidator\n{\n    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)\n    { \".pdf\", \".doc\", \".docx\", \".xls\", \".xlsx\", \".ppt\", \".pptx\",\n      \".jpg\", \".jpeg\", \".png\", \".webp\", \".txt\" };\n\n    private static readonly Dictionary<string, byte[][]> MagicBytes = new()\n    {\n        [\".pdf\"] = new[] { new byte[] { 0x25, 0x50, 0x44, 0x46 } },\n        [\".png\"] = new[] { new byte[] { 0x89, 0x50, 0x4E, 0x47 } },\n        [\".jpg\"] = new[] { new byte[] { 0xFF, 0xD8, 0xFF } },\n        // ... boshqa formatlar\n    };\n\n    public static void Validate(IFormFile file, long maxSize = 50 * 1024 * 1024)\n    {\n        if (file == null || file.Length == 0)\n            throw new ValidationException(\"Fayl bo'sh\");\n        if (file.Length > maxSize)\n            throw new ValidationException($\"Fayl hajmi {maxSize / 1024 / 1024} MB dan oshmasligi kerak\");\n\n        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();\n        if (!AllowedExt.Contains(ext))\n            throw new ValidationException($\"Fayl turi ruxsat etilmagan: {ext}\");\n\n        if (MagicBytes.TryGetValue(ext, out var signatures))\n        {\n            using var stream = file.OpenReadStream();\n            var header = new byte[8];\n            stream.Read(header, 0, header.Length);\n            if (!signatures.Any(sig => header.Take(sig.Length).SequenceEqual(sig)))\n                throw new ValidationException(\"Fayl tarkibi extension bilan mos kelmaydi\");\n        }\n    }\n}"),
    ],
    acceptance=[
        ".exe, .dll, .sh, .bat fayllarni yuklash imkonsiz",
        "Extension va Content-Type ni soxtalashtirilgan fayllar rad etiladi (magic bytes orqali)",
        "Barcha 5 ta upload controller ValidateFileUpload chaqiradi",
        "Mavjud yuklangan fayllar (orqada qolgan) script bilan tekshirilgan",
    ],
)

# ----- Task 1.3 -----
add_task_block(
    doc, "1.3",
    "JWT tokenlarni httpOnly cookie ga ko'chirish",
    "KRITIK", "5-7 kun", "Full-stack jamoa",
    steps=[
        "Backend AuthController da login javobini o'zgartiring: accessToken va refreshToken ni "
        "JSON body o'rniga Set-Cookie header orqali yuboring.",
        "Cookie sozlamalari: HttpOnly=true, Secure=true (HTTPS sozlangandan keyin), "
        "SameSite=Strict, Path=/, Domain=<intranet-domain>.",
        "CSRF himoyasi qo'shing: AspNetCore Antiforgery yoki Double-Submit Cookie pattern. "
        "GET dan boshqa metodlarda X-CSRF-Token header ni tekshiring.",
        "Frontend lib/api.ts dan localStorage o'qishlarni olib tashlang. Axios ga "
        "`withCredentials: true` qo'shing.",
        "authStore.ts da accessToken va refreshToken maydonlarini olib tashlang. "
        "Faqat user ma'lumotlari (id, name, permissions) localStorage da qoladi.",
        "Logout endpoint ni qo'shing — server cookie ni o'chirib tashlasin.",
        "Refresh interceptor logikasini server-side ga ko'chiring — frontend faqat 401 da "
        "/api/auth/refresh ga POST yuboradi, cookie avtomatik kelib qayta yangilanadi.",
    ],
    code_blocks=[
        ("Backend — AuthController.Login javobi",
         "var cookieOptions = new CookieOptions\n{\n    HttpOnly = true,\n    Secure = true,           // production HTTPS bilan\n    SameSite = SameSiteMode.Strict,\n    Path = \"/\",\n    Expires = DateTime.UtcNow.AddMinutes(30)\n};\nResponse.Cookies.Append(\"access_token\", accessToken, cookieOptions);\n\nvar refreshCookie = cookieOptions with { Expires = DateTime.UtcNow.AddDays(7), Path = \"/api/auth\" };\nResponse.Cookies.Append(\"refresh_token\", refreshToken, refreshCookie);\n\nreturn Ok(new { result = new { user = userDto } });"),
        ("Frontend — lib/api.ts",
         "export const api = axios.create({\n  baseURL: process.env.NEXT_PUBLIC_API_URL,\n  withCredentials: true,  // cookie avtomatik yuboriladi\n  headers: { \"X-Requested-With\": \"XMLHttpRequest\" }\n});\n\n// CSRF token interceptor\napi.interceptors.request.use((config) => {\n  if (config.method !== \"get\") {\n    const csrf = getCookie(\"XSRF-TOKEN\");\n    if (csrf) config.headers[\"X-CSRF-Token\"] = csrf;\n  }\n  return config;\n});"),
    ],
    acceptance=[
        "localStorage da hech qanday token yo'q (DevTools > Application > Local Storage)",
        "Cookie lar HttpOnly, Secure, SameSite=Strict bayroqlari bilan o'rnatiladi",
        "CSRF token bo'lmagan POST/PUT/DELETE so'rovlari 403 qaytaradi",
        "Logout cookie ni server-side da o'chiradi (Set-Cookie: ...; Max-Age=0)",
        "XSS demonstratsiyasida hujumchi token ni ololmaydi",
    ],
    notes=[
        "Intranet uchun cookie Domain ni ichki domain (masalan, '.korxona.local') ga "
        "sozlang yoki domain ko'rsatmaslik bilan host-only cookie ishlatish mumkin.",
    ],
)

# ----- Task 1.4 -----
add_task_block(
    doc, "1.4",
    "Ichki HTTPS sertifikat o'rnatish",
    "KRITIK", "3-5 kun", "DevOps",
    steps=[
        "Korxonada ichki Certificate Authority (CA) tashkil qiling. Eng oddiy yechim — "
        "Active Directory Certificate Services (AD CS) yoki step-ca (smallstep) lokal o'rnatma.",
        "Ichki CA sertifikatini barcha xodimlar ish kompyuterlariga \"Trusted Root\" sifatida "
        "qo'shing (Group Policy orqali avtomatlashtirish mumkin).",
        "API server (Back/src/API) uchun sertifikat generatsiya qiling. Subject Alternative Names "
        "(SAN) ga ichki DNS nom va IP manzilni kiriting.",
        "Backend Kestrel yoki nginx/IIS reverse proxy da HTTPS ni yoqing.",
        "Frontend .env.local va production konfiguratsiyada NEXT_PUBLIC_API_URL ni "
        "https://api.korxona.local:5223 ga o'zgartiring.",
        "Backend Program.cs da app.UseHsts() va HSTS sozlamalarini yoqing.",
        "Sertifikat muddati tugashidan 30 kun oldin ogohlantirish (monitoring orqali) sozlang.",
    ],
    code_blocks=[
        ("Self-signed sertifikat (test uchun, PowerShell)",
         "$cert = New-SelfSignedCertificate `\n  -DnsName \"api.korxona.local\", \"192.168.30.55\" `\n  -CertStoreLocation \"cert:\\LocalMachine\\My\" `\n  -NotAfter (Get-Date).AddYears(5) `\n  -KeyAlgorithm RSA -KeyLength 2048\n\n# PFX export\n$pwd = ConvertTo-SecureString -String \"changeit\" -Force -AsPlainText\nExport-PfxCertificate -Cert $cert -FilePath C:\\certs\\api.pfx -Password $pwd"),
        ("appsettings.Production.json — Kestrel HTTPS",
         "{\n  \"Kestrel\": {\n    \"Endpoints\": {\n      \"Https\": {\n        \"Url\": \"https://0.0.0.0:5223\",\n        \"Certificate\": {\n          \"Path\": \"C:\\\\certs\\\\api.pfx\",\n          \"Password\": \"<user-secrets dan>\"\n        }\n      }\n    }\n  }\n}"),
    ],
    acceptance=[
        "Browser HTTPS belgisi yashil rangda (sertifikat ishonchli)",
        "HTTP so'rovlari avtomatik HTTPS ga yo'naltiriladi",
        "HSTS header serverdan qaytadi: Strict-Transport-Security: max-age=31536000",
        "Foydalanuvchi kompyuterlarida \"Not secure\" ogohlantirishi yo'q",
    ],
    notes=[
        "Internet bo'lmagani uchun Let's Encrypt ishlatib bo'lmaydi. AD CS yoki step-ca eng yaxshi tanlov.",
        "Step-ca: GitHub dan offline o'rnatish uchun barcha binary va dependency larni oldindan yuklab oling.",
    ],
)

# ============================================================================
# SPRINT 2: YUQORI
# ============================================================================
add_heading(doc, "4.2. Sprint 2 — YUQORI vazifalar (3-4 hafta)", level=2)

# ----- Task 2.1 -----
add_task_block(
    doc, "2.1",
    "Rate limiting va login lockout",
    "YUQORI", "3-4 kun", "Backend dasturchi",
    steps=[
        "Program.cs ga .NET 8 ning built-in AddRateLimiter() ni qo'shing.",
        "/api/auth/login uchun fixed window limiter: 5 urinish / daqiqada / IP.",
        "/api/auth/refresh uchun: 10 urinish / daqiqada / IP.",
        "Boshqa API endpointlar uchun umumiy limit: 100 so'rov / daqiqada / foydalanuvchi.",
        "AuthService.cs da LoginAttempts entity yarating (UserId, IpAddress, AttemptedAt, Success).",
        "5 marta ketma-ket muvaffaqiyatsiz urinishdan keyin foydalanuvchi 15 daqiqaga blok bo'lsin.",
        "Admin uchun blokirovkani qo'lda olib tashlash endpointi yarating (UserController.UnlockUser).",
    ],
    code_blocks=[
        ("Program.cs — Rate limiter",
         "builder.Services.AddRateLimiter(options =>\n{\n    options.AddFixedWindowLimiter(\"login\", opt =>\n    {\n        opt.PermitLimit = 5;\n        opt.Window = TimeSpan.FromMinutes(1);\n        opt.QueueLimit = 0;\n    });\n    options.AddFixedWindowLimiter(\"refresh\", opt =>\n    {\n        opt.PermitLimit = 10;\n        opt.Window = TimeSpan.FromMinutes(1);\n    });\n    options.OnRejected = (ctx, _) =>\n    {\n        ctx.HttpContext.Response.StatusCode = 429;\n        return new ValueTask();\n    };\n});\n\napp.UseRateLimiter();\n\n// Controller da:\n[EnableRateLimiting(\"login\")]\n[HttpPost(\"login\")]\npublic async Task<IActionResult> Login(...) { ... }"),
    ],
    acceptance=[
        "Login da 6-urinishda 429 Too Many Requests qaytadi",
        "5 marta xato parol kiritgandan keyin user 15 daqiqaga blok bo'ladi",
        "Bloklangan user uchun ogohlantirish UI da ko'rinadi",
        "Admin panel orqali blokni olib tashlash mumkin",
    ],
)

# ----- Task 2.2 -----
add_task_block(
    doc, "2.2",
    "Xavfsizlik hodisalari logging va audit trail",
    "YUQORI", "5-7 kun", "Backend dasturchi",
    steps=[
        "Core/Entities/ da SecurityAuditLog entity yarating: Id, EventType, UserId (nullable), "
        "IpAddress, UserAgent, Details (JSON), CreatedAt.",
        "Application/Services/ISecurityAuditService va Impl/SecurityAuditService yarating.",
        "Quyidagi hodisalarni log qiling: LoginSuccess, LoginFailed, PermissionDenied, "
        "TokenRevoked, TokenRefreshed, PasswordChanged, UserLocked, UserUnlocked, RoleChanged, "
        "FileUploaded, FileDownloaded (faqat sensitive fayllar).",
        "AuthService.cs va PermissionAuthorizationHandler ga audit chaqiruvlari qo'shing.",
        "IP manzilni olish uchun: HttpContext.Connection.RemoteIpAddress, agar reverse proxy "
        "ortida bo'lsa X-Forwarded-For header ni o'qing.",
        "Admin uchun audit log ko'rish sahifasi yarating (frontend): filtrlar (sana, "
        "foydalanuvchi, hodisa turi), pagination.",
        "Logni 1 yil saqlash siyosatini qo'llang. Eskirgan loglarni avtomatik arxivlash "
        "uchun background job (Quartz.NET yoki Hangfire).",
    ],
    code_blocks=[
        ("SecurityAuditLog entity",
         "public class SecurityAuditLog\n{\n    public Guid Id { get; set; } = Guid.NewGuid();\n    public string EventType { get; set; } = null!;  // LoginFailed, PermDenied, ...\n    public Guid? UserId { get; set; }\n    public string? UserName { get; set; }\n    public string? IpAddress { get; set; }\n    public string? UserAgent { get; set; }\n    public string? Details { get; set; }  // JSON\n    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;\n}"),
        ("Foydalanish (AuthService da)",
         "if (!success)\n{\n    await _audit.LogAsync(new()\n    {\n        EventType = \"LoginFailed\",\n        UserName = login,\n        IpAddress = _httpContext.Connection.RemoteIpAddress?.ToString(),\n        UserAgent = _httpContext.Request.Headers.UserAgent,\n        Details = JsonSerializer.Serialize(new { reason = \"InvalidPassword\" })\n    });\n}"),
    ],
    acceptance=[
        "Barcha login urinishlari (success/fail) loglanadi",
        "Permission denied hodisalari log da ko'rinadi",
        "Admin audit log ni filtr orqali ko'ra oladi",
        "1 yildan eski loglar avtomatik arxivlanadi",
    ],
    notes=[
        "Markazlashtirilgan log aggregation uchun intranetda: Elastic Stack (Elasticsearch + Kibana) "
        "lokal o'rnatish yoki yengilroq Grafana Loki.",
        "Alerting uchun Grafana ichida qoidalar yarating: '10 daqiqada 100+ failed login' yoki "
        "'1 user 5+ permission denied'.",
    ],
)

# ----- Task 2.3 -----
add_task_block(
    doc, "2.3",
    "Security headers va CSP",
    "YUQORI", "2-3 kun", "Frontend + Backend dasturchi",
    steps=[
        "Backend Program.cs ga security headers middleware qo'shing (NetEscapades.AspNetCore.SecurityHeaders nuget paketi yoki qo'lda).",
        "Frontend client/next.config.ts da headers() funksiyasini qo'shing.",
        "Quyidagi headerlar majburiy: X-Content-Type-Options: nosniff, X-Frame-Options: DENY, "
        "Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(), microphone=(), geolocation=().",
        "CSP (Content-Security-Policy) ni mantiqiy ko'rib chiqing. Boshlang'ich qiymat: "
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.korxona.local",
        "CSP Report-Only rejimida 1 hafta sinash, keyin majburiy rejimga o'tkazish.",
        "Production build da source maps ni o'chiring: next.config.ts da `productionBrowserSourceMaps: false`.",
    ],
    code_blocks=[
        ("client/next.config.ts",
         "const securityHeaders = [\n  { key: \"X-Content-Type-Options\", value: \"nosniff\" },\n  { key: \"X-Frame-Options\", value: \"DENY\" },\n  { key: \"Referrer-Policy\", value: \"strict-origin-when-cross-origin\" },\n  { key: \"Permissions-Policy\", value: \"camera=(), microphone=(), geolocation=()\" },\n  { key: \"Strict-Transport-Security\", value: \"max-age=31536000; includeSubDomains\" },\n  {\n    key: \"Content-Security-Policy\",\n    value: [\n      \"default-src 'self'\",\n      \"script-src 'self'\",\n      \"style-src 'self' 'unsafe-inline'\",\n      \"img-src 'self' data: blob: https://api.korxona.local\",\n      \"connect-src 'self' https://api.korxona.local\",\n      \"font-src 'self' data:\",\n      \"frame-ancestors 'none'\",\n    ].join(\"; \"),\n  },\n];\n\nmodule.exports = {\n  productionBrowserSourceMaps: false,\n  async headers() {\n    return [{ source: \"/(.*)\", headers: securityHeaders }];\n  },\n};"),
    ],
    acceptance=[
        "securityheaders.com (yoki ichki ekvivalent) tahlilida A+ baho",
        "CSP buzilishlari konsol da ko'rinmaydi",
        "Production build da .map fayllar yo'q",
    ],
)

# ----- Task 2.4 -----
add_task_block(
    doc, "2.4",
    "Global exception handler",
    "YUQORI", "1-2 kun", "Backend dasturchi",
    steps=[
        ".NET 8 ning IExceptionHandler interfeysidan foydalaning yoki middleware yozing.",
        "Production muhitda stack trace foydalanuvchiga ko'rinmasligi kerak. Faqat: "
        "{ error: \"InternalServerError\", traceId: \"<guid>\" }",
        "Development muhitida to'liq xato batafsil ko'rinsin.",
        "Barcha exception lar SecurityAuditLog ga emas, balki standart Serilog/ILogger ga "
        "yoziladi (file sink + Elasticsearch sink).",
        "Maxsus exception turlari uchun status code mapping: ValidationException → 400, "
        "UnauthorizedException → 401, ForbiddenException → 403, NotFoundException → 404.",
    ],
    code_blocks=[
        ("Back/src/API/Middlewares/GlobalExceptionHandler.cs",
         "public class GlobalExceptionHandler : IExceptionHandler\n{\n    private readonly ILogger<GlobalExceptionHandler> _log;\n    private readonly IWebHostEnvironment _env;\n\n    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)\n    {\n        var traceId = ctx.TraceIdentifier;\n        _log.LogError(ex, \"Unhandled exception. TraceId: {TraceId}\", traceId);\n\n        var (status, code) = ex switch\n        {\n            ValidationException => (400, \"ValidationFailed\"),\n            UnauthorizedAccessException => (401, \"Unauthorized\"),\n            KeyNotFoundException => (404, \"NotFound\"),\n            _ => (500, \"InternalServerError\")\n        };\n\n        ctx.Response.StatusCode = status;\n        var body = new\n        {\n            error = code,\n            traceId,\n            message = _env.IsDevelopment() ? ex.Message : null,\n            stack = _env.IsDevelopment() ? ex.StackTrace : null\n        };\n        await ctx.Response.WriteAsJsonAsync(body, ct);\n        return true;\n    }\n}\n\n// Program.cs\nbuilder.Services.AddExceptionHandler<GlobalExceptionHandler>();\napp.UseExceptionHandler();"),
    ],
    acceptance=[
        "Production muhitda stack trace ko'rinmaydi",
        "Har bir xato uchun TraceId qaytadi, log da topish mumkin",
        "Validation xatolari aniq 400 kodi bilan qaytadi",
    ],
)

# ============================================================================
# SPRINT 3: O'RTA
# ============================================================================
add_heading(doc, "4.3. Sprint 3 — O'RTA vazifalar (1-2 oy)", level=2)

# ----- Task 3.1 -----
add_task_block(
    doc, "3.1",
    "Dependency audit va ichki mirror sozlash",
    "O'RTA", "1 hafta", "DevOps + Tech lead",
    steps=[
        "Loyihada bir martalik audit o'tkazing: `npm audit` (client/) va `dotnet list package --vulnerable --include-transitive` (Back/).",
        "Topilgan barcha CRITICAL va HIGH zaifliklarni darhol yangilang.",
        "Ichki npm mirror sozlang: Verdaccio (lightweight) yoki Sonatype Nexus Repository OSS.",
        "Ichki NuGet feed sozlang: BaGet (open source) yoki Nexus Repository.",
        "Internet bor kompyuterda npm/nuget paketlarini sync qiluvchi script tayyorlang. "
        "Bu script kerakli paketlarni yuklaydi va ichki mirror ga uploadlaydi.",
        "Loyiha .npmrc va NuGet.config fayllarida ichki mirror manzili ko'rsatilsin.",
        "html2pdf.js o'rniga zamonaviy va saqlanayotgan kutubxonaga (pdfmake yoki backendda QuestPDF) "
        "ko'chish rejasini tuzing.",
        "Har oyda dependency audit o'tkazish jadvalini tuzing (calendar reminder).",
    ],
    code_blocks=[
        ("client/.npmrc",
         "registry=https://npm.korxona.local/\nstrict-ssl=true\ncafile=./certs/internal-ca.pem"),
        ("Back/NuGet.config",
         "<?xml version=\"1.0\"?>\n<configuration>\n  <packageSources>\n    <clear />\n    <add key=\"internal\" value=\"https://nuget.korxona.local/v3/index.json\" />\n  </packageSources>\n</configuration>"),
    ],
    acceptance=[
        "npm audit va dotnet vulnerable da CRITICAL/HIGH yo'q",
        "Ichki mirror ishlab turibdi, internet bo'lmasdan npm install/dotnet restore ishlaydi",
        "Oylik audit jadvali tasdiqlangan",
    ],
    notes=[
        "Verdaccio Docker image ni offline tarzda yuklab olish: internet bor mashinada "
        "`docker save verdaccio/verdaccio > verdaccio.tar`, keyin intranet ga olib o'tib "
        "`docker load < verdaccio.tar`.",
        "Nexus Repository OSS faqat 1 marotaba o'rnatilganda internetdan kerakli paketlarni "
        "proxy qiladi va keshlaydi, keyin offline ishlay oladi.",
    ],
)

# ----- Task 3.2 -----
add_task_block(
    doc, "3.2",
    "Backend permission coverage tekshiruvi",
    "O'RTA", "2-3 kun", "Backend dasturchi + QA",
    steps=[
        "Skript yozing (PowerShell yoki C# yordamchi tool) — barcha controller actionlarini "
        "skan qilib, [HasPermission] yoki [AllowAnonymous] yo'q bo'lganlarni topadi.",
        "Topilgan har bir endpoint uchun: maqsadli permission ni qo'shing yoki nima uchun "
        "ochiq qolayotganini hujjatlashtirib komment qoldiring.",
        "Yangi controller qo'shilganda majburiy [HasPermission] tekshirish uchun unit test yozing.",
        "Roslyn analyzer (CodeAnalysis) yoki integration test yarating — endpoint himoyalanmagan "
        "bo'lsa, build fail bo'lsin.",
    ],
    code_blocks=[
        ("Endpoint coverage analyzer (oddiy versiya)",
         "var controllers = Assembly.GetExecutingAssembly().GetTypes()\n    .Where(t => typeof(ControllerBase).IsAssignableFrom(t));\n\nforeach (var c in controllers)\n{\n    var actions = c.GetMethods(BindingFlags.Public | BindingFlags.Instance)\n        .Where(m => m.GetCustomAttribute<HttpMethodAttribute>() != null);\n\n    foreach (var action in actions)\n    {\n        var hasPerm = action.GetCustomAttribute<HasPermissionAttribute>() != null\n                   || action.GetCustomAttribute<AllowAnonymousAttribute>() != null;\n        if (!hasPerm)\n            Console.WriteLine($\"UNPROTECTED: {c.Name}.{action.Name}\");\n    }\n}"),
    ],
    acceptance=[
        "Barcha endpointlar yo [HasPermission] yo [AllowAnonymous] bilan belgilangan",
        "Integration test endpoint coverage ni tekshiradi va CI da ishlaydi",
    ],
)

# ----- Task 3.3 -----
add_task_block(
    doc, "3.3",
    "Penetratsion testlash (Pentest)",
    "O'RTA", "1-2 hafta", "Tashqi mutaxassis yoki ichki Security jamoa",
    steps=[
        "OWASP ZAP yoki Burp Suite Community Edition ni intranet test serveriga sozlang.",
        "Avtomatik skan o'tkazing: SQL injection, XSS, CSRF, authentication bypass, IDOR.",
        "Qo'lda test: privilege escalation, business logic flaws, race conditions.",
        "Topilgan har bir muammo uchun JIRA/Trello ticket yarating va prioritet belgilang.",
        "Test natijalarini ushbu hujjatga ilova qiling (4.4 bo'limi).",
        "Yiliga kamida 1 marta takroriy pentest jadvalini tuzing.",
    ],
    acceptance=[
        "Pentest hisoboti tayyor",
        "Critical va High darajadagi topilgan muammolar bartaraf etilgan",
        "Keyingi yillik pentest sanasi rejaga kiritilgan",
    ],
    notes=[
        "OWASP ZAP ni internet bor mashinada yuklab oling, keyin offline o'rnatish paketini "
        "intranet ga ko'chiring. Vulnerability database (passive scan rules) ni ham oldindan "
        "yuklab olish kerak.",
    ],
)

# ----- Task 3.4 -----
add_task_block(
    doc, "3.4",
    "Backup va disaster recovery rejasi",
    "O'RTA", "3-5 kun", "DevOps",
    steps=[
        "PostgreSQL avtomatik backup: kuniga to'liq backup, har soatda incremental WAL backup.",
        "Yuklangan fayllarni (Back/src/API/uploads/) har kuni rsync orqali backup serverga ko'chiring.",
        "Backup larni alohida fizik joyda saqlang (boshqa server xonasi yoki shifrlangan tashqi disk).",
        "Backup larni shifrlang (GPG yoki age) — agar disk o'g'irlansa, ma'lumotlar ochilmasin.",
        "Har choragda backup dan to'liq restore testini o'tkazing.",
        "RTO (Recovery Time Objective) va RPO (Recovery Point Objective) ni hujjatlashtiring.",
    ],
    acceptance=[
        "Kunlik backup avtomatik ishlaydi, fail bo'lsa email/Telegram alert keladi",
        "Backup restore har choragda muvaffaqiyatli sinaladi",
        "Disaster recovery hujjati (DR Plan) tayyor",
    ],
)

doc.add_page_break()

# ---------------------------------------------------------------------------
# 5. UMUMIY TAVSIYALAR
# ---------------------------------------------------------------------------
add_heading(doc, "5. Uzoq muddatli xavfsizlik tavsiyalari", level=1)

add_heading(doc, "5.1. Xavfsizlik madaniyati", level=2)
add_bullet(doc, "Code review da xavfsizlik tekshiruvi majburiy bandlar ro'yxati (security checklist) joriy qiling.")
add_bullet(doc, "Yangi xodimlar uchun OWASP Top 10 va xavfsiz dasturlash treningi tayyorlang.")
add_bullet(doc, "Har 6 oyda barcha dasturchilar uchun xavfsizlik bo'yicha qisqa imtihon o'tkazing.")
add_bullet(doc, "Yangi feature dizayni bosqichida threat modeling sessiya o'tkazing (STRIDE metodi).")

add_heading(doc, "5.2. Insider threat himoyasi", level=2)
add_bullet(doc, "Ishdan bo'shagan xodimning hisobi va kalitlari darhol o'chiriladigan tartib joriy qiling.")
add_bullet(doc, "Eng katta huquqlarga ega rollar (SuperAdmin) faqat 1-2 ishonchli shaxsda bo'lsin.")
add_bullet(doc, "Ish stollarida ekran lock vaqti 5 daqiqa ga sozlang (Group Policy).")
add_bullet(doc, "USB portlarni cheklab qo'ying yoki nazorat ostiga oling (DLP yechimlari).")
add_bullet(doc, "Database ga to'g'ridan-to'g'ri ulanish faqat DBA da bo'lsin, dasturchilar API orqali ishlasin.")

add_heading(doc, "5.3. Monitoring va alerting", level=2)
add_bullet(doc, "Grafana + Prometheus stek ni intranetda o'rnating. Asosiy metrikalar: API latency, error rate, login fail rate, suspicious activity.")
add_bullet(doc, "Alert qoidalari: 1 daqiqada 50+ failed login, 1 user dan 100+ permission denied, "
                "API javob vaqti 2s dan oshsa, disk 80% to'lganda.")
add_bullet(doc, "Alertlar Telegram bot orqali yoki ichki email (Postfix) orqali yetkazib berilsin.")

add_heading(doc, "5.4. Hujjatlashtirish", level=2)
add_bullet(doc, "Har bir xavfsizlik incident i uchun post-mortem hujjat yozing (sabab, ta'sir, ishlangan choralar).")
add_bullet(doc, "Architecture Decision Records (ADR) — xavfsizlikka oid har bir muhim qaror uchun qisqa hujjat.")
add_bullet(doc, "Ushbu auditni har yili yangilang va o'zgarishlarni kuzating.")

doc.add_page_break()

# ---------------------------------------------------------------------------
# 6. XULOSA
# ---------------------------------------------------------------------------
add_heading(doc, "6. Xulosa", level=1)

add_paragraph(doc,
    "E-Korxona platformasi xavfsizlik bo'yicha o'rta darajada turibdi (6/10). Loyihaning kuchli "
    "tomonlari — JWT validation, BCrypt parol xeshlash, refresh token rotation va EF Core "
    "parametrlash. Asosiy zaifliklar — maxfiy ma'lumotlarning konfiguratsiya fayllarida "
    "saqlanishi, fayl upload da MIME validatsiyaning yo'qligi va xavfsizlik hodisalarini "
    "log qilmaslik.")

doc.add_paragraph()

add_paragraph(doc,
    "Sprint 1 (KRITIK) vazifalarini 2 hafta ichida bajarish orqali xavfsizlik darajasini "
    "8/10 ga ko'tarish mumkin. Barcha 3 sprint tugagandan keyin ball 9/10 ga yetadi va loyiha "
    "korxona ichki ishlatilishi uchun yetarli xavfsizlik darajasiga ega bo'ladi.")

doc.add_paragraph()

add_paragraph(doc,
    "Tizim intranetda ishlashi xavfsizlik talablarini biroz yengillashtiradi (masalan, public "
    "exposure yo'q), lekin insider threat va lokal tarmoq hujumlari (ARP spoofing, MITM) "
    "yuqori bo'ladi. Shu sabab cookie-based auth, HTTPS va audit logging hatto intranetda ham "
    "majburiy hisoblanadi.")

doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
r = p.add_run(f"Hujjat oxiri  ·  {today}")
r.font.name = "Calibri"
r.font.size = Pt(9)
r.font.color.rgb = COLOR_MUTED
r.italic = True

# ---------------------------------------------------------------------------
# Saqlash
# ---------------------------------------------------------------------------
output_path = Path(__file__).parent / "SECURITY_AUDIT.docx"
doc.save(str(output_path))
print(f"OK: {output_path}")
print(f"   Sahifalar (approx): ~{len(doc.paragraphs) // 30}")
print(f"   Hajmi: {output_path.stat().st_size / 1024:.1f} KB")
