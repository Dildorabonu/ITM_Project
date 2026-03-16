# Loyihani sozlash qo'llanmasi

## 1. Reponi clone qilish

```bash
git clone https://github.com/Dildorabonu/ITM_Project.git
cd ITM_Project
```

---

## 2. `.env` fayl yaratish

`.env` fayl GitHub'da yo'q — har kim o'ziniki yaratadi.

```bash
cp .env.example .env
```

Keyin `.env` faylni oching va o'z ma'lumotlaringizni kiriting:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE_NAME
```

**Masalan:**
```env
DATABASE_URL=postgresql://postgres:1234@localhost:5432/itm_db
```

---

## 3. Python virtual environment yaratish

```bash
cd server

# Yangi venv yaratish (avvalgi venv ishlamaydi — har kim o'ziniki yaratadi)
py -m venv venv

# Aktivlashtirish (Windows)
venv\Scripts\activate
```

---

## 4. Kutubxonalarni o'rnatish

```bash
pip install fastapi sqlalchemy psycopg2-binary alembic python-dotenv uvicorn
```

---

## 5. PostgreSQL database yaratish

pgAdmin'da yangi database yarating yoki Python orqali:

```bash
python -c "
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
conn = psycopg2.connect(host='localhost', port=5432, user='postgres', password='YOUR_PASSWORD', database='postgres')
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute('CREATE DATABASE YOUR_DATABASE_NAME')
cur.close()
conn.close()
print('Database yaratildi!')
"
```

> `YOUR_PASSWORD` va `YOUR_DATABASE_NAME` o'rniga `.env` faylidagi qiymatlarni yozing.

---

## 6. Server ishga tushirish

```bash
cd server
venv\Scripts\activate
uvicorn app.main:app --reload
```

Server ishga tushganda **migration avtomatik bajariladi** — jadvallar o'zi yaratiladi.

---

## Gitignore haqida

Quyidagi fayllar/papkalar `.gitignore` da — GitHub'ga yuklanmaydi:

| Fayl/Papka | Sabab |
|---|---|
| `.env` | Shaxsiy parol va konfiguratsiya — har kim o'ziniki yaratadi |
| `server/venv/` | Virtual environment — har kompda qayta yaratiladi |
| `**/__pycache__/` | Python cache fayllari — avtomatik yaratiladi |
| `client/node_modules/` | NPM paketlar — `npm install` bilan qayta o'rnatiladi |

### Siz ham ignore qilishingiz kerak bo'lgan narsalar

Agar qo'shimcha fayl yaratsangiz, `.gitignore` ga qo'shing:

```bash
# Misol: test fayllarini ignore qilish
echo "test_*.py" >> .gitignore

# Misol: bitta faylni ignore qilish
echo "server/config_local.py" >> .gitignore
```

---

## Yangi migration qo'shish (model o'zgarganda)

```bash
cd server
venv\Scripts\activate

# Yangi migration fayl yaratish
venv\Scripts\alembic.exe revision --autogenerate -m "o'zgarish tavsifi"

# Migratsiyani qo'llash
venv\Scripts\alembic.exe upgrade head
```

> Boshqa jamoa a'zolari `git pull` qilgandan keyin server qayta ishga tushirsa — migration avtomatik qo'llanadi.
