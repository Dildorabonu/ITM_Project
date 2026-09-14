====================================================================
  ITM FACTORY — O'RNATISH VA ISHGA TUSHIRISH
====================================================================

TALAB QILINADI
--------------
Server bo'ladigan kompyuterda faqat bitta narsa oldindan o'rnatilgan
bo'lishi kerak:

    PostgreSQL   ->  https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

O'rnatish paytida "postgres" foydalanuvchisiga qo'ygan PAROLNI eslab qoling —
u pastdagi 2-qadamda so'raladi.

Node.js va .NET O'RNATISH SHART EMAS — ikkalasi ham shu papka ichida bor.
Boshqa (ishchi) kompyuterlarga esa umuman hech narsa o'rnatilmaydi, faqat
brauzer kerak.


1-QADAM — PAPKANI KO'CHIRING
----------------------------
Shu papkani serverdagi doimiy joyga ko'chiring, masalan:

    C:\ITM

Ish stoli (Desktop) yoki Downloads emas — papka o'chib ketmasligi kerak.


2-QADAM — BOSHLASH.bat NI BOSING
--------------------------------
BOSHLASH.bat ustiga ikki marta bosing.

Birinchi safar u:
  - Administrator huquqini so'raydi ("Ha" / "Yes" ni bosing);
  - PostgreSQL manzili, porti, foydalanuvchisi, baza nomi va parolini
    so'raydi — paroldan boshqasi uchun shunchaki Enter bosavering
    (localhost, 5432, postgres, ITM);
  - "ITM" nomli bazani yaratadi;
  - Windows Firewall'da 3000-portni ochadi;
  - backend va frontendni ishga tushiradi;
  - brauzerda http://localhost:3000 ni ochadi.

Birinchi ishga tushish 1-2 daqiqa davom etadi (baza jadvallari yaratiladi).
Keyingi safarlar bir necha soniya.


3-QADAM — LITSENZIYA
--------------------
Birinchi ishga tushgan kundan boshlab tizim 30 KUN BEPUL SINOV rejimida
to'liq ishlaydi — hech qanday token kiritish shart emas, hamma narsa
ishlaydi. Sinov muddati birinchi ishga tushgan kundan sanaladi va
serverni qayta yoqish yoki qayta ishga tushirish uni tiklamaydi.

Shu 30 kun ichida doimiy litsenziya oling:

1. BOSHLASH.bat oynasida "SERVERNING BARMOQ IZI" degan 16 belgili kod
   ko'rsatiladi. Masalan:

        A1B2C3D4E5F60718

2. Shu kodni tizim ta'minotchisiga yuboring. U sizga aynan shu
   kompyuterga bog'langan litsenziya tokenini beradi.

3. Tokenni olgach:
     - Brauzerda tepadagi "Litsenziya" bo'limini (yoki sinov tugagach
       chiqadigan qulf oynasidagi "Faollashtirish"ni) oching;
     - Tokenni joylashtiring;
     - Parol maydoniga superadmin foydalanuvchining parolini kiriting;
     - Tasdiqlang.

Agar 30 kun ichida token kiritilmasa, sinov tugaydi va tizim bloklanadi —
o'shanda token kiritilsa yana ochiladi (ma'lumotlar saqlanib qoladi).


4-QADAM — BOSHQA KOMPYUTERLARDAN KIRISH
---------------------------------------
BOSHLASH.bat oynasida server IP manzili ko'rsatiladi, masalan:

    Boshqa kompyuterlarda: http://192.168.1.50:3000

Xodimlar o'z kompyuterlaridagi brauzerga aynan shu manzilni yozadi.

MUHIM: server kompyuterning IP manzili o'zgarib qolmasligi kerak.
Router sozlamalaridan yoki Windows tarmoq sozlamalaridan shu kompyuterga
statik (o'zgarmas) IP belgilash tavsiya etiladi.


5-QADAM — AVTOMATIK ISHGA TUSHIRISH (tavsiya etiladi)
-----------------------------------------------------
AVTOMATIK.bat ni bir marta bosing (Administrator huquqi so'raladi).

Shundan keyin server kompyuter har yoqilganda tizim O'ZI ko'tariladi:
hech kim Windows'ga kirmasa ham, hech kim hech narsa bosmasa ham.
Elektr o'chib yonganda ham tizim o'zini tiklaydi.

O'chirish uchun: AVTOMATIK-OCHIRISH.bat


FAYLLAR
-------
BOSHLASH.bat            Tizimni ishga tushiradi (asosiy fayl)
TOXTATISH.bat           Tizimni to'xtatadi
AVTOMATIK.bat           Kompyuter yoqilganda o'zi ishga tushsin
AVTOMATIK-OCHIRISH.bat  Avtomatik ishga tushirishni o'chiradi
SOZLASH.bat             Baza parolini qaytadan kiritish (parol o'zgarsa)
logs\                   Xatoliklar jurnali
backend\uploads\        Yuklangan fayllar va rasmlar


MUAMMO BO'LSA
-------------
Administrator oynasi chiqdi, parolni bilmayman
    Birinchi sozlash, TOXTATISH.bat va AVTOMATIK.bat Administrator
    huquqisiz ishlamaydi — firewall qoidasi va Windows vazifasi shusiz
    qo'shilmaydi. Kompyuter administratoriga murojaat qiling.
    Birinchi sozlash bir marta o'tgach, keyingi BOSHLASH.bat larda
    Administrator so'ralmaydi.

"PostgreSQL javob bermayapti"
    services.msc ni oching, "postgresql-x64-..." xizmatini toping va
    ishga tushiring. Xizmat turi "Automatic" bo'lsin.

"Parol noto'g'ri"
    PostgreSQL o'rnatishda kiritilgan parolni kiriting. Esdan chiqqan
    bo'lsa PostgreSQL'ni qayta o'rnatish kerak bo'ladi.

"Backend ishga tushmadi"
    logs\backend.err.log va logs\backend.log fayllarini oching —
    xatolik sababi o'sha yerda yoziladi.

Boshqa kompyuterlar kira olmayapti
    1. Ikkala kompyuter ham bitta tarmoqda (bitta router/switch) ekanini
       tekshiring.
    2. Server kompyuterda BOSHLASH.bat ni bir marta o'ng tugma ->
       "Run as administrator" bilan oching (firewall qoidasi qo'shiladi).
    3. Antivirus dasturi 3000-portni to'sib qo'ymaganini tekshiring.

Sahifa ochilyapti, lekin "Litsenziya faol emas" deb turibdi
    3-QADAM ga qarang — litsenziya tokeni kiritilishi kerak.


ESLATMA — MA'LUMOTLAR NUSXASI (BACKUP)
--------------------------------------
Barcha ma'lumot PostgreSQL'dagi "ITM" bazasida, yuklangan fayllar esa
backend\uploads\ papkasida saqlanadi. Muntazam nusxa olib turing:

    pg_dump -U postgres -d ITM -F c -f C:\backup\itm.dump

====================================================================
