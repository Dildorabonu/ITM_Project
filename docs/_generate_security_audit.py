"""
E-Korxona xavfsizlik auditi DOCX generatori.

Bu skript `SECURITY_AUDIT.docx` faylini yaratadi — OWASP Top 10 (2021) bo'yicha
loyiha mosligi va kamchiliklarni bartaraf etish bo'yicha qadamma-qadam vazifalar.

Hujjat mazmuni faqat quyidagi yordamchi funksiyalar (DSL) orqali yoziladi:
add_heading, add_paragraph, add_centered, add_bullet, add_numbered,
add_code_block, add_severity_line, add_spacer, add_page_break,
add_info_table, add_scorecard_table, add_changelog_table, add_status_table,
add_task_block, add_footer_line.

Foydalanish:
    python docs/_generate_security_audit.py
"""

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
                  size: float = 11, color: RGBColor = COLOR_TEXT) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.bold = bold
    run.italic = italic


def add_centered(doc: Document, text: str, size: float = 11, bold: bool = False,
                 italic: bool = False, color: RGBColor = COLOR_TEXT) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def add_footer_line(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run(text)
    run.font.name = "Calibri"
    run.font.size = Pt(9)
    run.italic = True
    run.font.color.rgb = COLOR_MUTED


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


def add_spacer(doc: Document) -> None:
    doc.add_paragraph()


def add_page_break(doc: Document) -> None:
    doc.add_page_break()


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


SEVERITY_COLORS = {
    "KRITIK": COLOR_DANGER,
    "YUQORI": COLOR_DANGER,
    "O'RTA": COLOR_WARN,
    "ORTA": COLOR_WARN,
    "PAST": COLOR_SUCCESS,
    "YAXSHI": COLOR_SUCCESS,
    "BAJARILDI": COLOR_SUCCESS,
    "QISMAN": COLOR_WARN,
    "OCHIQ": COLOR_DANGER,
}


def add_severity_badge(paragraph, label: str) -> None:
    run = paragraph.add_run(f"  [{label}]  ")
    run.bold = True
    run.font.name = "Calibri"
    run.font.size = Pt(10)
    run.font.color.rgb = SEVERITY_COLORS.get(label, COLOR_TEXT)


def add_severity_line(doc: Document, label: str) -> None:
    add_severity_badge(doc.add_paragraph(), label)


def _fill_table(doc: Document, headers, widths, rows, bold_cols=(0,),
                color_col: int = -1):
    """Umumiy jadval quruvchi. headers=None bo'lsa sarlavha qatori chizilmaydi."""
    has_head = headers is not None
    table = doc.add_table(rows=len(rows) + (1 if has_head else 0), cols=len(widths))
    table.autofit = False

    if has_head:
        for i, h in enumerate(headers):
            cell = table.rows[0].cells[i]
            cell.width = widths[i]
            cell.paragraphs[0].text = ""
            run = cell.paragraphs[0].add_run(h)
            run.font.name = "Calibri"
            run.font.size = Pt(10.5)
            run.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            set_cell_borders(cell)
            set_cell_bg(cell, COLOR_BG_HEADER)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

    start = 1 if has_head else 0
    for ridx, row in enumerate(rows, start=start):
        cells = table.rows[ridx].cells
        for cidx, val in enumerate(row):
            cell = cells[cidx]
            cell.width = widths[cidx]
            cell.paragraphs[0].text = ""
            run = cell.paragraphs[0].add_run(val)
            run.font.name = "Calibri"
            run.font.size = Pt(10)
            run.bold = cidx in bold_cols
            if cidx == color_col:
                run.font.color.rgb = SEVERITY_COLORS.get(
                    val.strip().upper(), COLOR_TEXT)
            else:
                run.font.color.rgb = COLOR_TEXT
            set_cell_borders(cell)
            if (ridx - start) % 2 == 1:
                set_cell_bg(cell, COLOR_BG_ROW_ALT)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    return table


def add_info_table(doc: Document, rows) -> None:
    table = _fill_table(doc, None, (Cm(5.0), Cm(9.5)), rows, bold_cols=(0,))
    table.alignment = WD_ALIGN_PARAGRAPH.CENTER


def add_scorecard_table(doc: Document, rows) -> None:
    """rows: (kategoriya, holat, v1 ball, v2 ball, izoh)"""
    _fill_table(
        doc,
        ("Kategoriya", "Holat", "v1.0", "v2.0", "Asosiy topilma"),
        (Cm(4.2), Cm(2.0), Cm(1.3), Cm(1.3), Cm(7.7)),
        rows,
        bold_cols=(0, 3),
        color_col=1,
    )


def add_changelog_table(doc: Document, rows) -> None:
    """rows: (sana, o'zgarish, kategoriya)"""
    _fill_table(
        doc,
        ("Sana", "O'zgarish", "OWASP"),
        (Cm(2.3), Cm(11.2), Cm(3.0)),
        rows,
        bold_cols=(0,),
    )


def add_status_table(doc: Document, rows) -> None:
    """rows: (vazifa, holat, izoh)"""
    _fill_table(
        doc,
        ("v1.0 vazifasi", "Holat", "Izoh"),
        (Cm(6.0), Cm(2.6), Cm(7.9)),
        rows,
        bold_cols=(0,),
        color_col=1,
    )


def add_task_block(doc: Document, num: str, title: str, severity: str,
                   estimate: str, owner: str, steps=None,
                   code_blocks=None, acceptance=None, notes=None) -> None:
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
    for step in (steps or []):
        add_numbered(doc, step)

    for lang, code in (code_blocks or []):
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

for section in doc.sections:
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)

style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

# ############################## MAZMUN BOSHI ###############################
# ---------------------------------------------------------------------------
# Sarlavha sahifasi
# ---------------------------------------------------------------------------
add_centered(doc, "E-KORXONA", size=36, bold=True, color=COLOR_PRIMARY)
add_centered(doc, "RAQAMLI KORXONA PLATFORMASI", size=12, italic=True, color=COLOR_MUTED)
add_spacer(doc)
add_centered(doc, "XAVFSIZLIK AUDITI HISOBOTI", size=22, bold=True, color=COLOR_TEXT)
add_centered(doc, "OWASP Top 10 (2021) bo'yicha mosligi va bartaraf etish rejasi", size=13, color=COLOR_MUTED)
add_centered(doc, "2-nashr — v1.0 dan keyingi xavfsizlik ishlari hisobga olingan holda qayta ko'rib chiqildi", size=11, italic=True, color=COLOR_MUTED)
add_spacer(doc)
add_spacer(doc)

add_info_table(doc, [
    ("Hujjat versiyasi", "2.0 (qayta ko'rib chiqilgan nashr)"),
    ("Tayyorlangan sana", "2026-08-20"),
    ("Oldingi nashr", "1.0 — 2026-05-22"),
    ("Audit doirasi", "Backend (.NET 8) + Frontend (Next.js 16)"),
    ("Tekshirilgan kod holati", "main tarmog'i, 073f212 (2026-08-11)"),
    ("Deploy muhiti", "Korxona ichki tarmog'i (intranet, internetga ulanish yo'q)"),
])

add_page_break(doc)

# ---------------------------------------------------------------------------
# 1. KIRISH
# ---------------------------------------------------------------------------
add_heading(doc, "1. Kirish", level=1)

add_heading(doc, "1.1. Hujjat maqsadi", level=2)
add_paragraph(doc,
    "Ushbu hujjat E-Korxona (ITM Factory) platformasining xavfsizlik holatini "
    "OWASP Top 10 (2021) standarti bo'yicha baholaydi. Bu — 2026-05-22 dagi 1.0 "
    "nashrning qayta ko'rib chiqilgan versiyasi: o'sha nashrdan keyin loyihada bajarilgan "
    "xavfsizlik ishlari tekshirildi va baholar yangilandi.")
add_bullet(doc, "v1.0 dan keyin nima o'zgargani va qaysi vazifalar yopilgani (1.4 va 5-bo'limlar)")
add_bullet(doc, "Har bir kategoriya bo'yicha hozirgi holat va ochiq qolgan kamchiliklar (3-bo'lim)")
add_bullet(doc, "Qolgan muammolarni bartaraf etish bo'yicha sprintlarga taqsimlangan vazifalar (4-bo'lim)")

add_heading(doc, "1.2. Deploy muhiti haqida muhim eslatma", level=2)
add_paragraph(doc,
    "Tizim korxonaning ichki tarmog'ida (intranet) ishlaydi va internetga ulanish "
    "imkoniyati yo'q. Bu quyidagi xavfsizlik qarorlariga ta'sir qiladi:")
add_bullet(doc, "Tashqi CDN, Let's Encrypt va boshqa internet xizmatlaridan foydalanib bo'lmaydi. "
                "SSL sertifikatlar ichki CA orqali yoki self-signed bo'lishi kerak.")
add_bullet(doc, "NPM, NuGet paketlari va Docker imijlari deploy oldidan ichki mirror serverga "
                "tayyorlab qo'yiladi (Verdaccio / Nexus / private NuGet feed).")
add_bullet(doc, "Logging va monitoring tashqi xizmatlarsiz, ichki ELK/Grafana yoki shunga o'xshash "
                "lokal yechimlar orqali tashkil qilinadi.")
add_bullet(doc, "Tashqi tahdid yuzasi (attack surface) sezilarli darajada kichik. Asosiy xavf — "
                "ichki foydalanuvchilar (insider threats), zararli USB qurilmalar, lokal tarmoqdagi "
                "MITM hujumlari va social engineering.")
add_bullet(doc, "Tizim litsenziya bilan himoyalangan va mijoz serveriga bog'langan (MachineGuid "
                "fingerprint). Litsenziya yaroqsiz bo'lsa barcha /api so'rovlari bloklanadi.")

add_heading(doc, "1.3. Audit metodologiyasi", level=2)
add_paragraph(doc,
    "Audit OWASP Top 10 (2021) standarti asosida o'tkazildi. Backend (.NET 8 Clean Architecture) "
    "va frontend (Next.js 16 + React 19) kodlari avtomatlashtirilgan tahlil hamda qo'lda ko'rib "
    "chiqish (manual review) usullari bilan baholandi. Ushbu nashrda qo'shimcha ravishda "
    "v1.0 dan keyingi git tarixi va joriy `main` holati taqqoslandi.")
add_bullet(doc, "Tekshirilgan kod: `Back/src/` (Core, DataAccess, Application, API) va `client/`.")
add_bullet(doc, "Avtomatlashtirilgan testlar: `Back/test/Application.Tests` — 286 ga yaqin test metodi, "
                "shu jumladan xavfsizlikka oid `SecurityHelpersTests` (CORS origin, fayl imzolari, "
                "refresh token entropiyasi) va `AuthServiceTests` (lockout mantiqi).")
add_bullet(doc, "Baholash shkalasi 1.0 nashrdagi bilan bir xil — natijalar to'g'ridan-to'g'ri "
                "taqqoslanadi (scorecard jadvalida v1.0 va v2.0 ustunlari yonma-yon).")

add_heading(doc, "1.4. v1.0 nashrdan keyingi o'zgarishlar", level=2)
add_paragraph(doc,
    "2026-05-22 dan 2026-08-20 gacha loyihada quyidagi xavfsizlik o'zgarishlari amalga oshirildi. "
    "Bu jadval hujjatning asosiy yangilanishi — quyidagi baholar aynan shu ishlar natijasida o'zgardi.",
    bold=True)
add_spacer(doc)

add_changelog_table(doc, [
    ("2026-05-22",
     "Maxfiy qiymatlar appsettings.json dan olib tashlandi (bo'sh placeholder qoldirildi); "
     "appsettings.Development.json .gitignore ga qo'shildi va appsettings.Development.example.json namunasi yaratildi",
     "A02, A05"),
    ("2026-05-22",
     "Fayl yuklash validatsiyasi: kengaytma allowlist (11 tur) + magic bytes (fayl imzosi) tekshiruvi, "
     "50 MB hajm chegarasi (FileValidator.cs)",
     "A05, A03"),
    ("2026-05-22",
     "Barcha javoblarda X-Content-Type-Options: nosniff, shu jumladan /uploads statik fayllarida",
     "A05"),
    ("2026-05-22",
     "JWT localStorage dan httpOnly cookie'ga ko'chirildi; CSRF Double-Submit Cookie himoyasi "
     "(CsrfValidationMiddleware) qo'shildi",
     "A07, A02"),
    ("2026-05-25",
     "Login va refresh endpointlariga rate limiting (IP bo'yicha), autentifikatsiyalangan foydalanuvchi "
     "bo'yicha global limiter; account lockout va LoginAttempts jadvali",
     "A04, A09"),
    ("2026-05-25",
     "Swagger UI Development muhitida ham Basic auth orqasiga olindi; env o'zgaruvchilari "
     "sozlanmagan bo'lsa umuman ochilmaydi",
     "A05"),
    ("2026-06-08",
     "CORS: host prefiksi (StartsWith) tekshiruvi o'rniga haqiqiy xususiy/loopback IP validatsiyasi "
     "(TrustedOriginValidator) — AllowCredentials bilan birga credential o'g'irlash yo'li yopildi",
     "A05, A01"),
    ("2026-06-08",
     "Refresh token Guid o'rniga CSPRNG 256-bit qiymat; lockout oynali hisoblash bilan doimiy "
     "bloklanish (DoS) xavfi bartaraf etildi",
     "A07, A04"),
    ("2026-06-08",
     "Yuklash yo'llari: kengaytma va sub-papka sanitizatsiyasi, fayl root ichida qolishi kafolati "
     "(FileStorageService); WEBP to'liq RIFF+WEBP imzo tekshiruvi",
     "A03"),
    ("2026-06-20",
     "Ruxsatlar JWT 'perm' claim'idan emas, har bir so'rovda bazadan jonli baholanadi — rol o'zgarishi "
     "darhol kuchga kiradi, eski token bilan ortiqcha huquq saqlanib qolmaydi",
     "A01"),
    ("2026-06-27",
     "X-Forwarded-For / X-Forwarded-Proto qo'llab-quvvatlash — Next.js proksisi orqasidan haqiqiy "
     "mijoz IP si rate limiting uchun aniqlanadi",
     "A04, A09"),
    ("2026-07-09",
     "Litsenziya tizimi: RSA-SHA256 imzo tekshiruvi, qurilma fingerprint (MachineGuid / machine-id), "
     "soat orqaga surilishini aniqlash va yaroqsiz holatda barcha /api so'rovlarini bloklovchi middleware",
     "A08"),
    ("2026-08-20",
     "Global exception handler (IExceptionHandler): ushlanmagan xatolik serverda traceId bilan "
     "loglanadi, mijozga stack trace o'rniga umumiy xabar qaytariladi; biznes qoidalari uchun "
     "DomainException -> 400",
     "A05, A09"),
    ("2026-08-20",
     "Xavfsizlik headerlari va Content-Security-Policy: frontendda har bir so'rovga alohida "
     "nonce beruvchi CSP (client/middleware.ts) hamda X-Frame-Options, Referrer-Policy va "
     "Permissions-Policy (next.config.ts); backendda barcha javoblarni qamrab oluvchi "
     "SecurityHeadersMiddleware",
     "A05, A03"),
])

add_page_break(doc)

# ---------------------------------------------------------------------------
# 2. UMUMIY SCORECARD
# ---------------------------------------------------------------------------
add_heading(doc, "2. Umumiy baholash (Scorecard)", level=1)

add_paragraph(doc,
    "Umumiy ball: 7.7/10 — oldingi nashrdagi 6/10 dan sezilarli o'sish. v1.0 dagi to'rtta KRITIK "
    "vazifadan uchtasi to'liq yopildi. Qolgan vazifalar bajarilsa ball 9/10 ga yetadi.",
    bold=True)
add_spacer(doc)

add_scorecard_table(doc, [
    ("A01: Broken Access Control", "Yaxshi", "7/10", "8/10",
     "Ruxsatlar har so'rovda bazadan jonli o'qiladi; barcha kontrollerlar kamida [Authorize] ostida"),
    ("A02: Cryptographic Failures", "O'rta", "3/10", "7/10",
     "Maxfiy qiymatlar repodan chiqarildi, tokenlar httpOnly cookie'da; HTTPS hali joriy etilmagan"),
    ("A03: Injection", "Yaxshi", "9/10", "9/10",
     "EF Core parametrlash; fayl nomi, kengaytma va yo'l sanitizatsiyasi kuchaytirildi"),
    ("A04: Insecure Design", "Yaxshi", "6/10", "8/10",
     "Rate limiting va DoS'ga chidamli account lockout joriy etildi"),
    ("A05: Security Misconfiguration", "O'rta", "6/10", "8/10",
     "Nonce'li CSP va xavfsizlik headerlari joriy etildi; Swagger Basic auth, CORS va exception "
     "handler tayyor; X-Forwarded-For ishonch chegarasi ochiq"),
    ("A06: Vulnerable Components", "O'rta", "6/10", "5/10",
     "xlsx (SheetJS) 0.18.5 — npm'da yangilanmaydigan ma'lum zaifliklar; audit jarayoni hali yo'q"),
    ("A07: Auth & Session Failures", "Yaxshi", "8/10", "9/10",
     "httpOnly cookie + CSRF double-submit + rotation/reuse detection + lockout"),
    ("A08: Data Integrity Failures", "Yaxshi", "9/10", "9/10",
     "Xavfli deserializatsiya yo'q; litsenziya tokeni RSA-SHA256 imzo bilan tekshiriladi"),
    ("A09: Logging & Monitoring", "O'rta", "4/10", "5/10",
     "Login urinishlari yozila boshladi; permission denied, ko'rish interfeysi va alerting yo'q"),
    ("A10: SSRF", "Yaxshi", "10/10", "9/10",
     "Foydalanuvchi boshqaradigan URL yo'q; Modbus TCP manzili faqat konfiguratsiyadan olinadi"),
])

add_spacer(doc)
add_paragraph(doc,
    "Izoh: A06 ballining pasayishi loyiha holati yomonlashgani emas, balki ushbu auditda aniq "
    "zaif paket (xlsx 0.18.5) aniqlangani natijasidir. A10 dagi 1 ball Modbus TCP fon xizmati "
    "qo'shilgani uchun — manzil foydalanuvchi emas, administrator tomonidan boshqariladi, "
    "shuning uchun xavf past.",
    italic=True, size=10, color=COLOR_MUTED)

add_page_break(doc)
# ---------------------------------------------------------------------------
# 3. BATAFSIL TAHLIL
# ---------------------------------------------------------------------------
add_heading(doc, "3. Kategoriya bo'yicha batafsil tahlil", level=1)
add_paragraph(doc,
    "Har bir kategoriyada uch blok berilgan: hozirgi holat, v1.0 dan keyin bartaraf etilgan "
    "kamchiliklar va hali ochiq qolgan kamchiliklar.",
    italic=True, size=10, color=COLOR_MUTED)

# ----- A01 -----
add_heading(doc, "A01: Broken Access Control", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Backendda HasPermissionAttribute -> PermissionAuthorizationHandler "
                "(Back/src/API/Authorization/) to'g'ri implementatsiya qilingan.")
add_bullet(doc, "ContractService.cs va CostNormService.cs da resurs darajasidagi ownership "
                "tekshiruvi mavjud (ContractUsers, ProductUsers, DepartmentId orqali).")
add_bullet(doc, "Talabnoma yaratish faqat foydalanuvchining o'z bo'limi doirasida cheklangan.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "Ruxsatlar endi JWT 'perm' claim'idan emas, har bir so'rovda bazadan o'qiladi "
                "(PermissionAuthorizationHandler). Rol o'zgartirilganda foydalanuvchi qayta login "
                "qilmasa ham o'zgarish darhol kuchga kiradi va bekor qilingan huquq eski token "
                "bilan ishlatib bo'lmaydi.")
add_bullet(doc, "Barcha 24 ta kontroller tekshirildi: har birida kamida sinf darajasida [Authorize] "
                "bor. Yagona [AllowAnonymous] — LicenseController (blok ekrani ishlashi uchun zarur).")
add_bullet(doc, "CORS origin tekshiruvi haqiqiy IP validatsiyasiga o'tkazildi — hujumchi domeni "
                "orqali credential bilan so'rov yuborish yo'li yopildi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Frontend faqat UI ni yashiradi. Bu me'moriy jihatdan to'g'ri (backend haqiqiy "
                "himoya), lekin yangi endpoint qo'shilganda [HasPermission] ni unutib qo'yish xavfi "
                "saqlanib qolmoqda — avtomatik coverage testi yo'q (Vazifa 2.4).")
add_bullet(doc, "Ayrim kontrollerlarda (Dashboard, Notification, Permission, Scan, Uploads, MeterData) "
                "faqat [Authorize] bor — har qanday autentifikatsiyalangan foydalanuvchi kira oladi. "
                "Ma'lumot turiga qarab bu qabul qilinadigan qaror, lekin hujjatlashtirilishi kerak.")
add_bullet(doc, "LicenseController /fingerprint va /status endpointlari autentifikatsiyasiz ochiq — "
                "server fingerprint qiymatini oshkor qiladi (past xavf, lekin ortiqcha ma'lumot).")

# ----- A02 -----
add_heading(doc, "A02: Cryptographic Failures", level=2)
add_severity_line(doc, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Parollar BCrypt bilan to'g'ri xeshlanadi (PasswordHelper.cs).")
add_bullet(doc, "JWT validation parametrlari to'liq sozlangan (Program.cs).")
add_bullet(doc, "Litsenziya tokeni RSA-SHA256 (PKCS#1) imzo bilan tekshiriladi; xususiy kalit "
                ".gitignore orqali repodan chetlashtirilgan.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "appsettings.json dagi DB connection string va JWT SecretKey bo'sh qoldirildi; "
                "haqiqiy qiymatlar repoga tushmaydigan appsettings.Development.json / muhit "
                "o'zgaruvchilaridan olinadi. Namuna sifatida appsettings.Development.example.json qo'shildi.")
add_bullet(doc, "Tokenlar endi localStorage'da emas, httpOnly cookie'da saqlanadi — JavaScript "
                "ularga umuman kira olmaydi.")
add_bullet(doc, "Refresh token Guid o'rniga kriptografik xavfsiz 256-bit tasodifiy qiymatdan hosil qilinadi.")
add_bullet(doc, "Cookie'ning Secure atributi so'rov sxemasiga qarab hisoblanadi (SecurePolicy=SameAsRequest) — "
                "HTTPS joriy etilgan zahoti kod o'zgarishisiz avtomatik kuchga kiradi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Eng muhim ochiq masala: transport hali ham HTTP. Ichki tarmoqda ham cookie'lar, "
                "parollar va PII ma'lumotlar ochiq matnda uzatiladi — ARP spoofing yoki port mirror "
                "orqali ushlab olish mumkin (Vazifa 1.1).")
add_bullet(doc, "app.UseHttpsRedirection() chaqirilgan, lekin HTTPS listener sozlanmagani uchun "
                "amalda hech qanday ta'sir ko'rsatmaydi.")
add_bullet(doc, "v1.0 gacha git tarixiga tushgan eski parol va kalitlar tozalanmagan bo'lsa, ular "
                "hamon tarixda qoladi — ifsho qilingan deb hisoblab, almashtirilishi kerak.")

# ----- A03 -----
add_heading(doc, "A03: Injection", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "EF Core parametrlash to'liq ishlatiladi. FromSqlRaw yoki string konkatenatsiyali "
                "SQL topilmadi.")
add_bullet(doc, "Process.Start, LDAP, OS command injection vektorlari yo'q.")
add_bullet(doc, "Frontendda dangerouslySetInnerHTML, eval, new Function() ishlatilmagan.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "FileStorageService: sub-papka nomi va kengaytma sanitizatsiya qilinadi, saqlangan "
                "fayl yo'li root papka ichida qolishi Path.GetFullPath bilan tasdiqlanadi "
                "(path traversal himoyasi).")
add_bullet(doc, "Saqlanadigan fayl nomi foydalanuvchi bergan nomdan emas, GUID dan hosil qilinadi — "
                "nom orqali hujum qilish imkoni yo'q.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Jiddiy kamchilik topilmadi. Yangi xom SQL yoki shell chaqiruvlari qo'shilsa, "
                "code review'da alohida tekshirilishi kerak.")

# ----- A04 -----
add_heading(doc, "A04: Insecure Design", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Parol murakkabligi qoidalari yaxshi: 8+ belgi, katta/kichik harf, raqam, maxsus belgi.")
add_bullet(doc, "Refresh token rotation + family-based reuse detection — kuchli himoya.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "Rate limiting joriy etildi: /api/auth/login va /api/auth/refresh IP bo'yicha "
                "cheklanadi (refresh — 10/daqiqa), qolgan /api so'rovlari esa autentifikatsiyalangan "
                "foydalanuvchi bo'yicha 300/daqiqa sliding window bilan cheklanadi. Chegara oshsa "
                "429 va Retry-After qaytariladi.")
add_bullet(doc, "Account lockout: sozlanadigan LockoutOptions (default 15 daqiqalik oynada 5 ta "
                "muvaffaqiyatsiz urinish -> 15 daqiqaga blok). Hisoblash LockoutEnd ga bog'langani "
                "uchun hujumchi hisobni cheksiz bloklab qo'ya olmaydi (DoS himoyasi).")
add_bullet(doc, "Har bir urinish LoginAttempts jadvaliga login, IP, vaqt va natija bilan yoziladi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Login uchun rate limit chegarasi 300/daqiqa — bu bitta IP uchun juda bo'sh. "
                "Asosiy himoyani lockout beradi, lekin foydalanuvchi nomlarini sanab chiqish "
                "(user enumeration) tezligi cheklanmaydi (Vazifa 1.2).")
add_bullet(doc, "Bloklangan hisobni administrator qo'lda ochish imkoniyati interfeysda yo'q: "
                "AuthService.UnlockUserAsync mavjud, lekin uni chaqiradigan endpoint yozilmagan. "
                "Blok tugashini kutishdan boshqa yo'l yo'q (Vazifa 2.3).")
add_bullet(doc, "Xato javob matni qolgan urinishlar sonini oshkor qiladi ('Yana N ta urinish qoldi') — "
                "foydalanuvchi qulayligi uchun qabul qilingan, lekin hujumchiga ham foydali ma'lumot.")
add_bullet(doc, "CAPTCHA yoki shunga o'xshash bot himoyasi yo'q (intranet uchun past ustuvorlik).")

# ----- A05 -----
add_heading(doc, "A05: Security Misconfiguration", level=2)
add_severity_line(doc, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Swagger faqat Development muhitida ochiladi.")
add_bullet(doc, "Yuklangan fayllar /uploads orqali nosniff header bilan beriladi.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "Hujjat upload endpointlarida kengaytma allowlist va magic bytes tekshiruvi joriy "
                "etildi (FileValidator.cs): .pdf, .doc(x), .xls(x), .ppt(x), .jpg, .jpeg, .png, "
                ".webp, .txt; hajm chegarasi 50 MB. Fayl tarkibi kengaytmaga mos kelmasa rad etiladi.")
add_bullet(doc, "Barcha javoblarga X-Content-Type-Options: nosniff qo'shildi.")
add_bullet(doc, "Swagger Development'da ham HTTP Basic auth orqasiga olindi; SWAGGER_USERNAME/"
                "SWAGGER_PASSWORD sozlanmagan bo'lsa 503 qaytariladi. Solishtirish doimiy vaqtli "
                "(FixedTimeEquals).")
add_bullet(doc, "CORS: 10., 192.168. kabi prefiks tekshiruvlari o'rniga host haqiqiy IP sifatida "
                "parse qilinadi va RFC 1918 / loopback / ULA diapazoniga tegishliligi tekshiriladi.")
add_bullet(doc, "appsettings.Development.json publish paketiga qo'shilmaydi (API.csproj) — dev "
                "litsenziya kaliti mijoz serveriga tushmaydi.")
add_bullet(doc, "Global exception handler joriy etildi (API/Middleware/GlobalExceptionHandler.cs): "
                "ushlanmagan xatolik to'liq stack trace bilan serverda loglanadi, mijozga esa "
                "faqat umumiy xabar va korrelyatsiya ID (traceId) qaytariladi. Biznes qoidasi "
                "buzilishi uchun alohida DomainException tipi 400 bilan qaytariladi.")
add_bullet(doc, "Frontendda xavfsizlik headerlari joriy etildi (client/next.config.ts): "
                "X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: "
                "strict-origin-when-cross-origin va Permissions-Policy barcha javoblarga qo'yiladi.")
add_bullet(doc, "Content-Security-Policy client/middleware.ts orqali beriladi: har bir so'rov "
                "uchun alohida nonce generatsiya qilinadi va Next.js o'zining inline skriptlariga "
                "shu nonce'ni qo'yadi, qolgan chunk'lar 'strict-dynamic' bilan yuklanadi — "
                "skriptlar uchun 'unsafe-inline' umuman ishlatilmaydi. Nonce keshlangan HTML da "
                "eskirmasligi uchun ildiz layout force-dynamic rejimiga o'tkazildi. Bosqichma-bosqich "
                "joriy qilish uchun CSP_REPORT_ONLY=true rejimi qoldirilgan.")
add_bullet(doc, "Backendda SecurityHeadersMiddleware barcha javoblarga (jumladan /uploads statik "
                "fayllari va xatolik javoblari) nosniff, X-Frame-Options, Referrer-Policy, "
                "Permissions-Policy va cheklovchi CSP (default-src 'none'; sandbox) qo'shadi — "
                "yuklangan SVG yoki HTML fayl to'g'ridan-to'g'ri ochilganda skript ishlamaydi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "ForwardedHeaders sozlamasida KnownNetworks va KnownProxies tozalangan, ya'ni "
                "X-Forwarded-For header'i har qanday manbadan qabul qilinadi. Mijoz o'zi shu "
                "header'ni yuborib, login uchun IP bo'yicha rate limit'ni chetlab o'ta oladi (Vazifa 1.2).")
add_bullet(doc, "AllowedHosts = \"*\" — Host header'i cheklanmagan. Ichki tarmoqda xavf past, "
                "lekin aniq host ro'yxati qo'yish tavsiya etiladi.")
add_bullet(doc, "next.config.ts da allowedDevOrigins ro'yxatida vaqtinchalik Cloudflare tunnel "
                "domeni qolgan — production build'ga chiqishidan oldin olib tashlanishi kerak.")

# ----- A06 -----
add_heading(doc, "A06: Vulnerable and Outdated Components", level=2)
add_severity_line(doc, "O'RTA")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Backend .NET 8 LTS ustida; EF Core 8.0.4, Npgsql 8.0.4, BCrypt.Net-Next 4.1.0, "
                "System.IdentityModel.Tokens.Jwt 7.5.2.")
add_bullet(doc, "Frontend Next.js 16.2.1, React 19.2.3, axios 1.13.6 — yangi versiyalar.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "xlsx (SheetJS) 0.18.5 — npm registrdagi oxirgi versiya, unda ma'lum zaifliklar "
                "(prototype pollution va ReDoS) bor va tuzatish faqat SheetJS o'z saytidagi 0.20+ "
                "versiyalarida. Excel import kodi shu paketga tayanadi (Vazifa 2.2).")
add_bullet(doc, "html2pdf.js 0.14.0 va mammoth 1.12.0 — kam yangilanadigan paketlar; ular "
                "foydalanuvchi bergan fayllarni brauzerda parse qiladi.")
add_bullet(doc, "npm audit va dotnet list package --vulnerable muntazam o'tkazilmaydi, natijalar "
                "hech qayerda qayd etilmaydi.")
add_bullet(doc, "Ichki NPM/NuGet mirror hali sozlanmagan — offline deploy paytida paket versiyalari "
                "nazorat qilinmaydi.")

# ----- A07 -----
add_heading(doc, "A07: Authentication & Session Failures", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "JWT validation to'liq: ValidateIssuer, ValidateAudience, ValidateLifetime, "
                "ValidateIssuerSigningKey, ClockSkew=Zero.")
add_bullet(doc, "Access token muddati 30 daqiqa, refresh token 3 kun — maqbul.")
add_bullet(doc, "Refresh token rotation + family-based reuse detection.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "Tokenlar localStorage'dan httpOnly cookie'ga ko'chirildi (AuthCookieWriter). "
                "XSS orqali token o'g'irlash yo'li yopildi. Frontend'da faqat 'kirilgan' belgisi "
                "sifatida user ob'ekti saqlanadi.")
add_bullet(doc, "Refresh token cookie'si alohida Path (/api/auth) bilan yoziladi — u faqat "
                "refresh so'rovlarida yuboriladi.")
add_bullet(doc, "SameSite=Strict va CSRF Double-Submit Cookie himoyasi birgalikda cookie-based "
                "auth uchun zarur bo'lgan CSRF xavfini qoplaydi.")
add_bullet(doc, "Account lockout muvaffaqiyatsiz urinishlar sonini cheklaydi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Foydalanuvchi o'z aktiv seanslarini ko'rish va 'barcha qurilmalardan chiqish' "
                "imkoniyati yo'q.")
add_bullet(doc, "CSRF himoyasi /api/license/activate uchun istisno qilingan (superadmin paroli "
                "bilan himoyalangan — qabul qilingan qaror, lekin hujjatlashtirilishi kerak).")
add_bullet(doc, "HTTPS bo'lmagani uchun cookie'lar Secure atributisiz yuboriladi — tarmoqni "
                "tinglash orqali seansni o'g'irlash nazariy jihatdan mumkin (Vazifa 1.1).")

# ----- A08 -----
add_heading(doc, "A08: Software & Data Integrity Failures", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "JsonSerializer xavfli TypeNameHandling sozlamalarisiz ishlatiladi.")
add_bullet(doc, "Foydalanuvchidan kelgan ma'lumot strict tipdagi DTO larga deserialize qilinadi.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "Litsenziya tizimi qo'shildi: token payload'i RSA-SHA256 imzo bilan tekshiriladi, "
                "public key ilova ichida, xususiy kalit repodan tashqarida. Imzo mos kelmasa "
                "litsenziya rad etiladi.")
add_bullet(doc, "Qurilma fingerprint (Windows MachineGuid / Linux machine-id) va soatni orqaga "
                "surish (tamper) aniqlash — litsenziyani boshqa serverga ko'chirish yoki muddatni "
                "cho'zish urinishlari bloklanadi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "Offline deploy paketi uchun imzo yoki xesh (checksum) tekshiruvi yo'q — "
                "yetkazib berish zanjiri qo'lda ishonchga tayanadi.")

# ----- A09 -----
add_heading(doc, "A09: Security Logging & Monitoring Failures", level=2)
add_severity_line(doc, "YUQORI")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Biznes hodisalar (kontrakt, shipment, task-log) ActivityLog jadvalida saqlanadi "
                "va dashboard'da ko'rsatiladi.")
add_paragraph(doc, "v1.0 dan keyin bartaraf etilgan:", bold=True, color=COLOR_SUCCESS)
add_bullet(doc, "LoginAttempts jadvali qo'shildi: har bir kirish urinishi uchun login, foydalanuvchi "
                "ID, IP manzil, vaqt va natija yoziladi.")
add_bullet(doc, "X-Forwarded-For qo'llab-quvvatlangani uchun proksi orqasidan ham haqiqiy mijoz IP si "
                "yoziladi.")
add_paragraph(doc, "Ochiq qolgan kamchiliklar:", bold=True)
add_bullet(doc, "LoginAttempts ma'lumotini ko'rish uchun hech qanday endpoint yoki interfeys yo'q — "
                "audit yozuvlari faqat bazaga to'g'ridan-to'g'ri kirish orqali o'qiladi.")
add_bullet(doc, "User-agent yozilmaydi; jadval uchun saqlash muddati (retention) va tozalash "
                "siyosati belgilanmagan — vaqt o'tishi bilan cheksiz o'sadi.")
add_bullet(doc, "Permission denied (403) hodisalari loglanmaydi — huquqni oshirishga urinishlar "
                "ko'rinmaydi.")
add_bullet(doc, "Token revoke, refresh va reuse detection hodisalari audit trail'ga tushmaydi, "
                "holbuki reuse detection aynan hujum belgisi hisoblanadi.")
add_bullet(doc, "Markazlashtirilgan log aggregation (ELK, Loki) va anomaliya bo'lganda "
                "ogohlantirish tizimi sozlanmagan.")

# ----- A10 -----
add_heading(doc, "A10: Server-Side Request Forgery", level=2)
add_severity_line(doc, "PAST")
add_paragraph(doc, "Hozirgi holat:", bold=True)
add_bullet(doc, "Foydalanuvchi tomonidan boshqariladigan URL ga HttpClient so'rovlari topilmadi. "
                "PDF generatsiyasida resolvePhoto() blob/data/https sxemalarini tekshiradi.")
add_paragraph(doc, "Yangi e'tibor talab qiladigan nuqta:", bold=True)
add_bullet(doc, "MeterPollerService fon xizmati konfiguratsiyada ko'rsatilgan IP:port ga (default "
                "192.168.30.222:502) Modbus TCP ulanish ochadi. Manzil faqat appsettings orqali "
                "beriladi, foydalanuvchi kiritmaydi — SSRF emas, lekin konfiguratsiya faylini "
                "o'zgartira oladigan har kim serverdan ixtiyoriy ichki manzilga ulanish "
                "o'tkaza oladi. Fayl ruxsatlari cheklangan bo'lishi kerak.")

add_page_break(doc)
# ---------------------------------------------------------------------------
# 4. QADAMMA-QADAM VAZIFALAR
# ---------------------------------------------------------------------------
add_heading(doc, "4. Qolgan kamchiliklarni bartaraf etish rejasi", level=1)
add_paragraph(doc,
    "v1.0 dagi 12 ta vazifadan 9 tasi to'liq, 1 tasi qisman bajarilgan (batafsil 5-bo'limda). "
    "Quyida faqat qolgan ishlar berilgan — ular yangidan raqamlangan va ustuvorlik bo'yicha "
    "3 ta sprintga taqsimlangan: YUQORI (1-2 hafta), O'RTA (3-4 hafta), REJALI (1-2 oy).")

# ============================================================================
# SPRINT 1: YUQORI
# ============================================================================
add_heading(doc, "4.1. Sprint 1 — YUQORI vazifalar (1-2 hafta)", level=2)

add_task_block(
    doc, "1.1",
    "Ichki HTTPS sertifikat o'rnatish",
    "YUQORI", "3-5 kun", "DevOps",
    steps=[
        "Korxona ichki CA (Certificate Authority) tashkil qiling. Windows Server'da Active Directory "
        "Certificate Services yoki Linux'da oddiy OpenSSL asosidagi CA yetarli.",
        "Backend (masalan itm-api.korxona.local) va frontend (itm.korxona.local) uchun server "
        "sertifikatlarini chiqaring. Sertifikatda SAN (Subject Alternative Name) sifatida DNS nomi "
        "va server IP manzilini ham ko'rsating.",
        "CA ildiz sertifikatini domendagi barcha ishchi kompyuterlarga Group Policy orqali "
        "'Trusted Root Certification Authorities' do'koniga tarqating.",
        "Kestrel'ni HTTPS uchun sozlang (appsettings yoki muhit o'zgaruvchilari orqali) yoki "
        "backend oldiga TLS terminatsiya qiluvchi reverse proxy (IIS / Nginx) qo'ying.",
        "Next.js frontendni ham HTTPS orqasiga qo'ying va BACKEND_URL ni https:// ga o'zgartiring.",
        "AuthCookies:SecurePolicy ni 'Always' ga o'zgartiring — HTTPS ishlagach cookie'lar faqat "
        "shifrlangan kanal orqali yuborilsin.",
        "HTTP portini yopmang, balki 301 redirect qilib qoldiring (UseHttpsRedirection allaqachon "
        "chaqirilgan) — eski yorliqlar ishlashda davom etadi.",
        "Sertifikat muddati tugashini kuzatish uchun taqvimga eslatma qo'ying (ichki CA'da "
        "avtomatik yangilanish yo'q).",
    ],
    code_blocks=[
        ("appsettings.Production.json — Kestrel HTTPS",
         "{\n  \"Kestrel\": {\n    \"Endpoints\": {\n      \"Https\": {\n        \"Url\": \"https://0.0.0.0:5443\",\n        \"Certificate\": { \"Path\": \"certs/itm-api.pfx\", \"Password\": \"<env-dan>\" }\n      }\n    }\n  },\n  \"AuthCookies\": { \"SecurePolicy\": \"Always\" }\n}"),
        ("OpenSSL — ichki CA va server sertifikati",
         "openssl genrsa -out ca.key 4096\nopenssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt\nopenssl req -new -nodes -out itm.csr -newkey rsa:2048 -keyout itm.key\nopenssl x509 -req -in itm.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out itm.crt -days 825 -sha256 -extfile san.cnf"),
    ],
    acceptance=[
        "Brauzerda ogohlantirish chiqmasdan https:// orqali kirish mumkin.",
        "Wireshark bilan tarmoqni tinglaganda login parol va cookie ko'rinmaydi.",
        "access_token va refresh_token cookie'larida Secure atributi bor (DevTools -> Application).",
        "HTTP manzil HTTPS ga avtomatik yo'naltiriladi.",
    ],
    notes=[
        "Let's Encrypt internetsiz ishlamaydi — faqat ichki CA yoki self-signed variant mos keladi.",
        "Sertifikat muddatini 1 yildan uzun qilmang; ildiz CA uchun 10 yil maqbul.",
        "Modbus poller va boshqa fon xizmatlari HTTPS o'zgarishidan ta'sirlanmaydi.",
    ],
)

add_task_block(
    doc, "1.2",
    "Rate limit chegaralarini qattiqlashtirish va X-Forwarded-For ishonch chegarasi",
    "YUQORI", "1-2 kun", "Backend dasturchi + DevOps",
    steps=[
        "Program.cs dagi ForwardedHeadersOptions da KnownNetworks.Clear() va KnownProxies.Clear() "
        "chaqiruvlarini olib tashlang.",
        "Buning o'rniga KnownProxies ga faqat Next.js frontend serverining haqiqiy IP manzilini "
        "qo'shing (yoki KnownNetworks ga o'sha kichik tarmoqni).",
        "Proksi IP sini konfiguratsiyadan oling (masalan ForwardedHeaders:KnownProxies massivi) — "
        "kod o'zgarmasdan muhitga moslashsin.",
        "login siyosatidagi PermitLimit ni 300/daqiqadan real qiymatga tushiring: bitta IP uchun "
        "10-20/daqiqa yetarli (lockout allaqachon 5 urinishda ishga tushadi).",
        "Xato javobidagi 'Yana N ta urinish qoldi' matnini qayta ko'rib chiqing — foydalanuvchi "
        "qulayligi va ma'lumot oshkorligi o'rtasidagi muvozanatni tanlang.",
        "O'zgarishdan keyin ikki mashinadan bir vaqtda login qilib, limit har bir mijoz uchun "
        "alohida hisoblanishini tekshiring.",
    ],
    code_blocks=[
        ("C# — ishonchli proksi ro'yxati",
         "var forwardedOptions = new ForwardedHeadersOptions\n{\n    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto\n};\nforwardedOptions.KnownProxies.Clear();\nforeach (var ip in builder.Configuration.GetSection(\"ForwardedHeaders:KnownProxies\").Get<string[]>() ?? [])\n    forwardedOptions.KnownProxies.Add(IPAddress.Parse(ip));\napp.UseForwardedHeaders(forwardedOptions);"),
    ],
    acceptance=[
        "Qo'lda X-Forwarded-For header'i yuborilgan so'rovda RemoteIpAddress o'zgarmaydi "
        "(proksi ro'yxatida bo'lmagan manbadan).",
        "Next.js proksi orqali kelgan so'rovlarda haqiqiy mijoz IP si aniqlanadi.",
        "Bitta IP dan 20 dan ortiq login urinishi 429 bilan rad etiladi.",
    ],
    notes=[
        "Frontend va backend bitta serverda bo'lsa, KnownProxies ga 127.0.0.1 va ::1 yetarli.",
    ],
)

add_page_break(doc)

# ============================================================================
# SPRINT 2: O'RTA
# ============================================================================
add_heading(doc, "4.2. Sprint 2 — O'RTA vazifalar (3-4 hafta)", level=2)

add_task_block(
    doc, "2.1",
    "Xavfsizlik hodisalari audit trail'ini to'ldirish",
    "O'RTA", "4-6 kun", "Backend dasturchi",
    steps=[
        "LoginAttempt entity'siga UserAgent ustunini qo'shing va AuthService.RecordAttemptAsync "
        "ichida to'ldiring (migration bilan).",
        "Permission denied hodisalarini yozing: PermissionAuthorizationHandler'da requirement "
        "bajarilmaganda foydalanuvchi ID, so'ralgan ruxsat, yo'l va IP bilan log yozuvi qoldiring.",
        "Refresh token hodisalarini yozing: rotation, revoke va ayniqsa reuse detection — "
        "oxirgisi hujum belgisi, shuning uchun alohida darajada (Warning) loglansin.",
        "Yozuvlarni ko'rish uchun endpoint qo'shing: GET /api/security/login-attempts "
        "(sahifalash va login/IP/sana bo'yicha filtr bilan), [HasPermission(\"Users.View\")] ostida.",
        "Frontendda 'Xavfsizlik jurnali' sahifasini yarating — muvaffaqiyatsiz urinishlar, "
        "bloklangan hisoblar va ruxsat rad etilishlari ko'rinsin.",
        "Retention siyosatini belgilang: masalan 180 kundan eski LoginAttempts yozuvlarini o'chiruvchi "
        "fon xizmati (kuniga bir marta).",
        "Loglarni fayl sifatida saqlash uchun strukturalangan logging (Serilog) qo'shing — "
        "keyinchalik ichki ELK/Loki ga uzatish oson bo'ladi.",
    ],
    code_blocks=[
        ("C# — permission denied logi",
         "if (pairs.Any(p => $\"{p.Module}.{p.Action}\" == requirement.Permission))\n{\n    context.Succeed(requirement);\n}\nelse\n{\n    _logger.LogWarning(\n        \"Permission denied. UserId={UserId} Permission={Permission} Path={Path} Ip={Ip}\",\n        userId, requirement.Permission, path, ip);\n}"),
    ],
    acceptance=[
        "Muvaffaqiyatsiz login urinishi jurnalda IP va user-agent bilan ko'rinadi.",
        "Ruxsati yo'q endpointga murojaat qilinganda log yozuvi paydo bo'ladi.",
        "Refresh token qayta ishlatilganda Warning darajasidagi yozuv chiqadi.",
        "180 kundan eski yozuvlar avtomatik o'chiriladi.",
    ],
    notes=[
        "ELK yoki Loki o'rniga oddiy fayl loglari + Grafana Agent ham intranetda yetarli.",
        "Jurnal sahifasi PII (login nomlari va IP) ko'rsatgani uchun uni alohida ruxsat ostiga oling.",
    ],
)

add_task_block(
    doc, "2.2",
    "Zaif paketlarni almashtirish va dependency audit jarayoni",
    "O'RTA", "1 hafta", "DevOps + Tech lead",
    steps=[
        "xlsx (SheetJS) 0.18.5 ni almashtiring. Uch variantdan birini tanlang: (a) SheetJS'ning "
        "rasmiy 0.20+ versiyasini ichki mirror'ga joylash, (b) exceljs ga o'tish, "
        "(c) Excel importni backendga ko'chirish (ClosedXML).",
        "html2pdf.js va mammoth uchun ham muqobil qidiring yoki ular ishlaydigan fayllarni "
        "ishonchli manba bilan cheklang.",
        "npm audit --omit=dev va dotnet list package --vulnerable buyruqlarini ishga tushiring, "
        "natijani hujjat sifatida saqlang.",
        "Ichki NPM mirror (Verdaccio) va NuGet feed (Nexus / BaGet) o'rnating; barcha paketlar "
        "faqat shu manbadan olinsin.",
        "package-lock.json va .csproj versiyalarini qat'iy (pinned) qiling — ^ prefiksini olib tashlang.",
        "Har chorakda dependency auditni takrorlash uchun taqvim eslatmasi va mas'ul shaxs belgilang.",
    ],
    code_blocks=[
        ("PowerShell — audit",
         "cd client\nnpm audit --omit=dev\ncd ..\\Back\\src\ndotnet list package --vulnerable --include-transitive"),
    ],
    acceptance=[
        "npm audit natijasida high yoki critical darajadagi zaiflik qolmagan (yoki har biri uchun "
        "yozma asoslash mavjud).",
        "Excel import funksiyasi almashtirilgan kutubxona bilan to'liq ishlaydi.",
        "Paketlar ichki mirror'dan o'rnatiladi, internet talab qilinmaydi.",
    ],
    notes=[
        "Offline muhitda mirror majburiy — aks holda deploy paytida paket versiyasi nazoratsiz qoladi.",
        "xlsx zaifliklari asosan ishonchsiz fayl ochilganda ishlaydi; Excel importni faqat "
        "ishonchli xodimlar uchun ochiq qoldirish vaqtinchalik yumshatuvchi chora bo'ladi.",
    ],
)

add_task_block(
    doc, "2.3",
    "Bloklangan hisobni administrator tomonidan ochish",
    "O'RTA", "1-2 kun", "Backend + Frontend dasturchi",
    steps=[
        "AuthService.UnlockUserAsync allaqachon mavjud — unga POST /api/user/{id}/unlock endpointini "
        "yozing va [HasPermission(\"Users.Update\")] bilan himoyalang.",
        "Foydalanuvchilar ro'yxatida bloklangan hisoblar uchun vizual belgi (badge) va 'Blokdan "
        "chiqarish' tugmasini qo'shing.",
        "Blokdan chiqarish amalini ActivityLog yoki xavfsizlik jurnaliga yozing — kim, qachon, kimni.",
        "Login sahifasidagi xato matnida foydalanuvchiga administratorga murojaat qilish "
        "yo'riqnomasini bering.",
    ],
    acceptance=[
        "Bloklangan foydalanuvchi ro'yxatda ajralib turadi.",
        "Ruxsatga ega admin bir bosishda blokni ochadi va foydalanuvchi darhol kira oladi.",
        "Blokdan chiqarish hodisasi jurnalda qoladi.",
    ],
)

add_task_block(
    doc, "2.4",
    "Backend permission coverage avtomatik testi",
    "O'RTA", "2-3 kun", "Backend dasturchi + QA",
    steps=[
        "Reflection orqali barcha kontroller action metodlarini aylanib chiquvchi test yozing.",
        "Har bir action uchun [HasPermission], [Authorize] yoki ataylab qo'yilgan [AllowAnonymous] "
        "borligini tekshiring; hech biri bo'lmasa test yiqilsin.",
        "Ataylab ochiq qoldirilgan endpointlar uchun aniq allowlist tuzing (masalan LicenseController) "
        "va uni izoh bilan hujjatlashtiring.",
        "Testni Back/test/Application.Tests yoniga yangi API.Tests loyihasida joylashtiring.",
        "Testni CI/build jarayoniga qo'shing — yangi endpoint himoyasiz qo'shilsa build yiqilsin.",
    ],
    code_blocks=[
        ("C# — coverage testi (soddalashtirilgan)",
         "[Fact]\npublic void Every_action_must_be_protected()\n{\n    var allowlist = new[] { \"LicenseController.GetFingerprint\", \"LicenseController.GetStatus\", \"LicenseController.Activate\", \"AuthController.Login\", \"AuthController.Refresh\" };\n\n    var unprotected = typeof(Program).Assembly.GetTypes()\n        .Where(t => typeof(ControllerBase).IsAssignableFrom(t))\n        .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))\n        .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any())\n        .Where(m => !HasAuth(m) && !allowlist.Contains($\"{m.DeclaringType!.Name}.{m.Name}\"))\n        .Select(m => $\"{m.DeclaringType!.Name}.{m.Name}\")\n        .ToList();\n\n    Assert.Empty(unprotected);\n}"),
    ],
    acceptance=[
        "Test barcha mavjud endpointlarda muvaffaqiyatli o'tadi.",
        "Atributsiz yangi endpoint qo'shilganda test yiqiladi va sabab aniq ko'rinadi.",
    ],
)

add_page_break(doc)

# ============================================================================
# SPRINT 3: REJALI
# ============================================================================
add_heading(doc, "4.3. Sprint 3 — Rejali vazifalar (1-2 oy)", level=2)

add_task_block(
    doc, "3.1",
    "Penetratsion testlash (Pentest)",
    "PAST", "1-2 hafta", "Tashqi mutaxassis yoki ichki Security jamoa",
    steps=[
        "Test doirasini (scope) aniqlang: backend API, frontend, autentifikatsiya oqimi, fayl "
        "yuklash, litsenziya moduli.",
        "Ichki tarmoqda alohida test muhitini (production nusxasi) tayyorlang — jonli baza ustida "
        "test o'tkazmang.",
        "OWASP Testing Guide (WSTG) bo'yicha qo'lda tekshiruv o'tkazing; OWASP ZAP yoki Burp Suite "
        "ni ichki tarmoqda ishlating.",
        "Alohida e'tibor bering: vertikal/gorizontal huquq oshirish, IDOR (boshqa bo'lim "
        "ma'lumotlariga kirish), CSRF himoyasini chetlab o'tish, fayl yuklash orqali RCE.",
        "Litsenziya modulini ham sinang: imzo almashtirish, soatni o'zgartirish, fingerprint ko'chirish.",
        "Topilmalarni CVSS bo'yicha baholang, tuzatish rejasini tuzing va qayta test o'tkazing.",
    ],
    acceptance=[
        "Pentest hisoboti tayyor va topilmalar ustuvorlik bo'yicha tartiblangan.",
        "Barcha KRITIK va YUQORI topilmalar tuzatilgan hamda qayta tekshirilgan.",
    ],
    notes=[
        "Internetsiz muhitda ZAP va Burp'ning offline versiyalari oldindan yuklab qo'yilishi kerak.",
    ],
)

add_task_block(
    doc, "3.2",
    "Backup va disaster recovery rejasi",
    "PAST", "3-5 kun", "DevOps",
    steps=[
        "PostgreSQL uchun kunlik to'liq (pg_dump) va soatlik WAL arxivlash sozlang.",
        "uploads papkasini (fayl biriktirmalari) kunlik nusxalang — baza va fayllar birga "
        "tiklanishi kerak.",
        "Nusxalarni alohida fizik serverda yoki NAS'da saqlang; saqlash muddati kamida 30 kun.",
        "Nusxalarni shifrlang (GPG yoki BitLocker) — insider threat kontekstida bu muhim.",
        "Har chorakda tiklash mashqini o'tkazing: bo'sh serverga to'liq tiklab, tizim ishlashini "
        "tekshiring va sarflangan vaqtni qayd eting.",
        "RTO (tiklash vaqti) va RPO (ma'lumot yo'qotish chegarasi) qiymatlarini rasman kelishing "
        "va hujjatlashtiring.",
    ],
    code_blocks=[
        ("PowerShell — kunlik backup (soddalashtirilgan)",
         "$date = Get-Date -Format 'yyyy-MM-dd'\n$dst  = \"\\\\backup-server\\itm\\$date\"\nNew-Item -ItemType Directory -Force $dst | Out-Null\n& pg_dump -h localhost -U postgres -Fc ITM -f \"$dst\\itm.dump\"\nCopy-Item -Recurse \"C:\\ITM\\API\\uploads\" \"$dst\\uploads\""),
    ],
    acceptance=[
        "Kunlik nusxa avtomatik olinadi va muvaffaqiyati kuzatiladi.",
        "Bo'sh serverga tiklash mashqi hujjatlashtirilgan va RTO ichida bajarilgan.",
    ],
)

add_task_block(
    doc, "3.3",
    "Deploy hardening checklisti",
    "PAST", "2-3 kun", "DevOps + Backend dasturchi",
    steps=[
        "appsettings da AllowedHosts ni \"*\" o'rniga aniq host ro'yxatiga o'zgartiring.",
        "next.config.ts dagi allowedDevOrigins ro'yxatidan vaqtinchalik Cloudflare tunnel "
        "domenini olib tashlang (production build'ga tushmasin).",
        "appsettings.Production.json va litsenziya kalitlari uchun fayl ruxsatlarini cheklang — "
        "faqat xizmat ishlaydigan hisob o'qiy olsin (icacls).",
        "Backend xizmatini administrator emas, alohida cheklangan xizmat hisobi ostida ishga tushiring.",
        "uploads papkasida skript bajarilishini OS darajasida bloklang.",
        "Offline deploy paketi uchun SHA-256 xesh fayli chiqaring va o'rnatishdan oldin tekshirishni "
        "yo'riqnomaga kiriting.",
        "Serverda faqat zarur portlar ochiq bo'lsin (Windows Firewall qoidalari); Modbus uchun "
        "chiquvchi ulanish faqat hisoblagich IP siga ruxsat etilsin.",
    ],
    acceptance=[
        "Checklist hujjat sifatida saqlangan va har deploydan oldin to'ldiriladi.",
        "Konfiguratsiya fayllarini xizmat hisobidan boshqa foydalanuvchi o'qiy olmaydi.",
    ],
)

add_page_break(doc)
# ---------------------------------------------------------------------------
# 5. v1.0 VAZIFALARINING BAJARILISH HOLATI
# ---------------------------------------------------------------------------
add_heading(doc, "5. v1.0 nashrdagi vazifalarning bajarilish holati", level=1)
add_paragraph(doc,
    "Quyidagi jadval 1.0 nashrda belgilangan 12 ta vazifaning hozirgi holatini ko'rsatadi. "
    "Ochiq va qisman bajarilgan vazifalar 4-bo'limda yangi raqamlar bilan davom ettirilgan.")
add_spacer(doc)

add_status_table(doc, [
    ("1.1 Maxfiy ma'lumotlarni appsettings dan olib tashlash", "Bajarildi",
     "appsettings.json bo'sh placeholder; Development fayli .gitignore da; example fayl qo'shilgan"),
    ("1.2 Upload endpointlariga MIME type whitelist", "Bajarildi",
     "Kengaytma allowlist + magic bytes + 50 MB chegara (FileValidator.cs); nosniff header"),
    ("1.3 JWT tokenlarni httpOnly cookie ga ko'chirish", "Bajarildi",
     "AuthCookieWriter + CsrfValidationMiddleware; localStorage'da token yo'q"),
    ("1.4 Ichki HTTPS sertifikat o'rnatish", "Ochiq",
     "Davom etadi -> yangi Vazifa 1.1. Cookie SecurePolicy tayyor, faqat sertifikat kerak"),
    ("2.1 Rate limiting va login lockout", "Bajarildi",
     "AddRateLimiter (login/refresh/global) + LockoutOptions + LoginAttempts jadvali"),
    ("2.2 Xavfsizlik hodisalari logging va audit trail", "Qisman",
     "Login urinishlari yoziladi; permission denied, ko'rish interfeysi va retention yo'q -> Vazifa 2.1"),
    ("2.3 Security headers va CSP", "Bajarildi",
     "next.config.ts + middleware.ts (nonce'li CSP) va backend SecurityHeadersMiddleware; "
     "X-Frame-Options, Referrer-Policy, Permissions-Policy qo'shildi"),
    ("2.4 Global exception handler", "Bajarildi",
     "IExceptionHandler (GlobalExceptionHandler.cs) + DomainException; javobda traceId, stack trace yo'q"),
    ("3.1 Dependency audit va ichki mirror sozlash", "Ochiq",
     "Zaif paket (xlsx 0.18.5) aniqlandi; audit jarayoni yo'q -> Vazifa 2.2"),
    ("3.2 Backend permission coverage tekshiruvi", "Qisman",
     "Qo'lda tekshirildi — barcha kontrollerlar himoyalangan; avtomatik test yo'q -> Vazifa 2.4"),
    ("3.3 Penetratsion testlash", "Ochiq",
     "Davom etadi -> yangi Vazifa 3.1"),
    ("3.4 Backup va disaster recovery rejasi", "Ochiq",
     "Davom etadi -> yangi Vazifa 3.2"),
])

add_spacer(doc)
add_paragraph(doc,
    "Bundan tashqari v1.0 da rejalashtirilmagan, lekin bajarilgan ishlar: CORS origin "
    "validatsiyasini qattiqlashtirish, refresh token entropiyasini oshirish, lockout DoS "
    "himoyasi, ruxsatlarni bazadan jonli baholash, Swagger'ni Basic auth orqasiga olish, "
    "fayl yo'llari sanitizatsiyasi va litsenziya yaxlitligini imzo bilan tekshirish.",
    italic=True, size=10, color=COLOR_MUTED)

add_page_break(doc)

# ---------------------------------------------------------------------------
# 6. UZOQ MUDDATLI TAVSIYALAR
# ---------------------------------------------------------------------------
add_heading(doc, "6. Uzoq muddatli xavfsizlik tavsiyalari", level=1)

add_heading(doc, "6.1. Xavfsizlik madaniyati", level=2)
add_bullet(doc, "Har bir pull request uchun xavfsizlik nuqtai nazaridan ko'rib chiqish majburiy bo'lsin; "
                "yangi endpoint qo'shilganda ruxsat atributi alohida tekshirilsin.")
add_bullet(doc, "Dasturchilar uchun yiliga kamida bir marta OWASP Top 10 bo'yicha ichki trening o'tkazing.")
add_bullet(doc, "Yangi kod uchun 'xavfsizlik checklist'i yarating: ruxsat, validatsiya, logging, "
                "xatolik ishlovi.")
add_bullet(doc, "Xavfsizlik hujjatlarini (ushbu hujjat, deploy checklisti, incident response) "
                "har chorakda qayta ko'rib chiqing.")

add_heading(doc, "6.2. Insider threat himoyasi", level=2)
add_bullet(doc, "Eng kam huquq (least privilege) tamoyili: har bir rolga faqat kerakli ruxsatlar berilsin; "
                "rollar har yarim yilda qayta ko'rib chiqilsin.")
add_bullet(doc, "Xodim ishdan bo'shaganda hisobini darhol o'chirish yoki bloklash tartibini yozing "
                "va HR jarayoniga bog'lang.")
add_bullet(doc, "Muhim amallar (kontrakt o'chirish, ombor hisobini o'zgartirish, rol berish) uchun "
                "audit yozuvi majburiy bo'lsin.")
add_bullet(doc, "USB portlarni Group Policy orqali cheklang; zararli qurilma ichki tarmoqdagi "
                "asosiy kirish vektorlaridan biri.")
add_bullet(doc, "Ma'lumotlar bazasiga to'g'ridan-to'g'ri kirish faqat cheklangan doiradagi "
                "shaxslarda bo'lsin — audit yozuvlari aynan shu yerda buzilishi mumkin.")

add_heading(doc, "6.3. Monitoring va alerting", level=2)
add_bullet(doc, "Ichki Grafana + Loki (yoki ELK) o'rnating — tashqi xizmat talab qilinmaydi.")
add_bullet(doc, "Ogohlantirish qoidalari: bir foydalanuvchi uchun ketma-ket 5+ muvaffaqiyatsiz login, "
                "ish vaqtidan tashqari faollik, refresh token reuse detection, litsenziya tamper flagi.")
add_bullet(doc, "Server resurslarini (CPU, disk, DB ulanishlari) kuzating — anomaliya ko'pincha "
                "xavfsizlik hodisasining birinchi belgisi bo'ladi.")
add_bullet(doc, "Ogohlantirishlar kimga borishini va javob berish tartibini oldindan belgilang.")

add_heading(doc, "6.4. Hujjatlashtirish", level=2)
add_bullet(doc, "Incident response rejasi: hodisa aniqlanganda kim, nima qiladi, qanday tartibda.")
add_bullet(doc, "Deploy checklisti (Vazifa 3.3) va sertifikat yangilash yo'riqnomasi.")
add_bullet(doc, "Ma'lumotlar klassifikatsiyasi: qaysi jadvallar PII yoki tijorat siri saqlaydi.")
add_bullet(doc, "Ushbu auditni har yarim yilda takrorlang — keyingi rejalashtirilgan nashr: 3.0.")

add_page_break(doc)

# ---------------------------------------------------------------------------
# 7. XULOSA
# ---------------------------------------------------------------------------
add_heading(doc, "7. Xulosa", level=1)

add_paragraph(doc,
    "1.0 nashrdan beri loyihaning xavfsizlik holati sezilarli darajada yaxshilandi. "
    "Umumiy ball 6/10 dan 7.7/10 ga ko'tarildi.")
add_spacer(doc)

add_paragraph(doc, "Asosiy yutuqlar:", bold=True)
add_bullet(doc, "Autentifikatsiya arxitekturasi qayta qurildi: tokenlar httpOnly cookie'da, "
                "CSRF himoyasi bilan birga. Bu v1.0 dagi eng jiddiy kamchiliklardan birini yopdi.")
add_bullet(doc, "Maxfiy qiymatlar kod bazasidan chiqarildi va konfiguratsiya namunasi bilan "
                "almashtirildi.")
add_bullet(doc, "Brute-force himoyasi to'liq: rate limiting, account lockout va urinishlar jurnali.")
add_bullet(doc, "Fayl yuklash endi kengaytma va fayl imzosi bo'yicha tekshiriladi, yo'llar "
                "sanitizatsiya qilinadi.")
add_bullet(doc, "Ruxsatlar tizimi jonli baholashga o'tkazildi va CORS haqiqiy IP validatsiyasi "
                "bilan qattiqlashtirildi.")
add_bullet(doc, "Xavfsizlikka oid mantiq avtomatlashtirilgan testlar bilan qoplandi "
                "(SecurityHelpersTests, AuthServiceTests).")
add_bullet(doc, "Xavfsizlik headerlari va nonce asosidagi CSP joriy etildi — clickjacking, "
                "XSS ning ta'siri va tashqi manzilga ma'lumot chiqarish yo'llari brauzer "
                "darajasida cheklandi.")

add_spacer(doc)
add_paragraph(doc, "Eng muhim ochiq masalalar:", bold=True)
add_bullet(doc, "HTTPS hali joriy etilmagan — bu qolgan yagona eng jiddiy kamchilik. Barcha cookie "
                "va parollar ichki tarmoqda ochiq matnda uzatiladi (Vazifa 1.1).")
add_bullet(doc, "X-Forwarded-For cheklanmagani uchun login rate limit'ni chetlab o'tish mumkin "
                "(Vazifa 1.2).")
add_bullet(doc, "Audit trail to'liq emas: permission denied va token hodisalari yozilmaydi, "
                "yozuvlarni ko'rish interfeysi yo'q (Vazifa 2.1).")
add_bullet(doc, "xlsx (SheetJS) 0.18.5 paketida ma'lum zaifliklar bor (Vazifa 2.2).")

add_spacer(doc)
add_paragraph(doc,
    "Sprint 1 (1-2 hafta) bajarilsa xavfsizlik darajasi 8.5/10 ga, barcha uch sprint "
    "yakunlangach 9/10 ga yetadi.",
    bold=True)
add_spacer(doc)
add_paragraph(doc,
    "Tizim intranetda ishlashi xavfsizlik talablarini biroz yengillashtiradi (tashqi tahdid "
    "yuzasi kichik), lekin insider threat va lokal tarmoq hujumlari (ARP spoofing, MITM) "
    "yuqori bo'lib qoladi. Shu sabab HTTPS va to'liq audit logging hatto intranetda ham "
    "majburiy hisoblanadi — cookie-based auth allaqachon joriy etilgani esa to'g'ri yo'nalishdagi "
    "eng katta qadam bo'ldi.")

add_spacer(doc)
add_spacer(doc)
add_footer_line(doc, "Hujjat oxiri  ·  v2.0  ·  2026-08-20")

# ############################## MAZMUN OXIRI ###############################

output_path = Path(__file__).parent / "SECURITY_AUDIT.docx"
doc.save(output_path)
print(f"Yaratildi: {output_path}")
