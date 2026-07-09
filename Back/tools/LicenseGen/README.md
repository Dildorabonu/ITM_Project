# ITM Litsenziya tizimi

Mijoz serveriga qo'yilgan tizim **imzolangan litsenziya** bilan cheklanadi. Muddat tugagach
barcha `/api` so'rovlari (login ham) bloklanadi va foydalanuvchiga blok ekrani ko'rsatiladi.

## Uch xavfdan himoya

| Xavf | Himoya |
|---|---|
| Serverni o'chirib-yoqish | Muddat/holat PostgreSQL bazasida saqlanadi — restart ta'sir qilmaydi |
| Server sanasini ortga surish | "Yuqori suv belgisi" (high-water mark) — ko'rilgan eng katta vaqt bazada + `%ProgramData%/ITM/sys.dat` da saqlanadi. Muddat `max(hozirgi_vaqt, high-water)` bilan tekshiriladi, shuning uchun soatni ortga surish yordam bermaydi. 48 soatdan ortiq ortga surish — abadiy blok (TAMPER) |
| Publish/fayllarni qayta ko'chirish | Muddat maxfiy kalit bilan imzolangan; ilovada faqat public key bor. Mijoz muddatni o'zgartira olmaydi, yangi token yasay olmaydi. Fayllarni qayta ko'chirish sanani o'zgartirmaydi |
| Bitta tokenni bir necha korxonada ishlatish | Token server "barmoq izi"ga (Windows MachineGuid) bog'lanadi (`--machine`). Boshqa serverda `MACHINE` xatosi bilan bloklanadi |

## Kalitlar

- **Public key** — `Application/Licensing/LicenseTokenValidator.cs` ichida (kodga kiritilgan).
- **Private key** — `Back/tools/LicenseGen/license-private.key` (git'ga qo'yilmaydi!).
  Bu faylni **yo'qotmang** — usiz yangi/uzaytirish litsenziyalari yasab bo'lmaydi.
  Xavfsiz joyda (parol menejeri/seyf) nusxasini saqlang.

## Yangi litsenziya (yoki uzaytirish) yasash

**1-qadam — server barmoq izini oling** (mijoz serverida). Ikki usul:

```bash
# Usul A: ilova ishlab turibmi (litsenziyasiz ham bu endpoint ochiq):
curl http://<server>:5223/api/license/fingerprint

# Usul B: LicenseGen'ni o'sha serverda ishga tushiring:
dotnet run -- fingerprint
```

**2-qadam — o'sha barmoq iziga bog'lab token yasang** (o'z kompyuteringizda):

```bash
cd Back/tools/LicenseGen

# Serverga bog'langan 30 kunlik token (TAVSIYA — bitta serverda ishlaydi):
dotnet run -- sign --customer "Korxona nomi" --days 30 --machine A7878E94418398BD

# --machine'siz — istalgan serverda ishlaydigan token (faqat maxsus hollarda):
dotnet run -- sign --customer "Korxona nomi" --days 30
```

Tokenni mijoz serveriga kiritishning **ikki usuli** bor:

### Usul 1 — Admin panel (TAVSIYA, fayl tahrirlash shart emas)

Superadmin sifatida kiring → chap menyu **Tizim → Litsenziya** → tokenni joylang +
superadmin parolini kiriting → **Faollashtirish**. Token bazaga saqlanadi (config'dan ustun).

Agar tizim allaqachon bloklangan bo'lsa (login ishlamaydi), blok ekranidagi
**"Admin: litsenziyani faollashtirish"** havolasi orqali xuddi shu tarzda token kiritiladi —
login shart emas, faqat superadmin paroli.

### Usul 2 — Config fayl

Chiqqan tokenni mijoz serverida **`appsettings.Production.json`** ga qo'ying:

```json
{
  "License": { "Key": "<token>" }
}
```

Yoki muhit o'zgaruvchisi orqali (config'dan ustun turadi):

```
License__Key=<token>
```

So'ng backend'ni qayta ishga tushiring. **Uzaytirish** — yangi token berib, shu maydonni
almashtirishning o'zi kifoya (baza tozalanmaydi).

## Muhim eslatmalar

- `appsettings.Development.json` da uzoq muddatli **dev token** bor — u faqat lokal ishlab
  chiqish uchun. `dotnet publish` uni **paketга qo'shmaydi** (API.csproj'da `CopyToPublishDirectory=Never`),
  shuning uchun mijoz `ASPNETCORE_ENVIRONMENT=Development` qilib chetlab o'ta olmaydi.
- Mijoz serverida `ASPNETCORE_ENVIRONMENT` **Production** bo'lishi kerak.
- Holatni tekshirish: `GET /api/license/status` (ochiq endpoint) — `valid`, `reason`, `daysLeft`, `expiresUtc`.

## Kalit juftligini qayta yaratish (faqat zarur bo'lsa)

```bash
cd Back/tools/LicenseGen
dotnet run -- keygen
```

Chiqqan PUBLIC key'ni `LicenseTokenValidator.PublicKeyB64` ga qo'ying va ilovani qayta build qiling.
Eski private key bilan yasalgan tokenlar endi ishlamaydi.
