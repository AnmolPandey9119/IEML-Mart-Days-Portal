# IEML Mart Sourcing Days — Admin Portal

Simple admin portal, sirf 3 cheezon ke liye:
1. **buyers** — jo log `ieml-martdays-registration.vercel.app` se register karte hain, unki list + ek checkbox jo tick hota hai jab wo visitor actually mart pe aata hai.
2. **Mart Owners** — abhi khali hai. Jab full list milegi, manually "Add" karke daal doge (ya baad me bulk import add kar sakte hain).
3. **Analytics** — sirf buyers ka: total, buyer type wise, country wise, checked-in vs pending, date-wise trend.

Koi extra complexity nahi — na stalls, na payments, na exhibitor booking. Sirf yeh 3 cheezein.

## Stack
- Backend: Node.js + Express (single `server.js` file, ~350 lines)
- DB: Postgres (Neon) — **same** database jo registration site already use kar raha hai
- Frontend: plain HTML/CSS/JS, koi build step nahi, koi framework nahi
- Hosting: Render (free/starter web service is enough)

## Setup — Step by Step

### 1. Neon DB ka connection string lo
Registration site (`ieml-martdays-registration.vercel.app`) jis Neon DB ko use kar raha hai, uska **connection string** chahiye. Yeh Neon dashboard → Project → Connection Details me milta hai. Yeh portal us DB ko sirf **read** karega (buyers ke liye) aur do naye cheezein add karega (attendance checkbox column + mart_owners table) — registration site ka existing data bilkul touch nahi hoga.

### 2. Migration chalao (ek baar)
Yeh 2 cheezein add karta hai — safe hai, dobara bhi chala sakte ho:
- `buyers` table me `attended` aur `attended_at` column (agar already nahi hai to)
- naya `mart_owners` table (khali)

Local machine pe:
```bash
cp .env.example .env
# .env me DATABASE_URL bhar do
npm install
npm run migrate
```

### 3. Column names — confirmed
`buyers` table ka confirmed schema (`server.js` ke top wale `COL` object me already daala hua hai):

```
urn TEXT PRIMARY KEY   ← koi alag id column nahi hai, urn hi primary key hai
buyer_type TEXT NOT NULL
full_name TEXT NOT NULL
company_name TEXT NOT NULL
designation TEXT
email TEXT NOT NULL
phone_number TEXT NOT NULL
address TEXT
district TEXT
state TEXT
country TEXT
pincode TEXT
registered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
```

Agar future me registration site ka schema change ho (naya column, naam badle), to sidebar me **"Check DB Columns"** pe click karke live Postgres se real column names dekh sakte ho, aur `server.js` ke top wale `COL` object me match karke edit kar dena — kahin aur kuch badalne ki zarurat nahi.

### 4. Render pe deploy karo
1. Is folder ko GitHub repo bana ke push karo (ya Render me existing repo se naya folder point karo agar bharat-expo portal ke saath monorepo rakhna hai)
2. Render dashboard → New → Web Service → apna repo select karo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment tab me yeh variables add karo:
   - `DATABASE_URL` — Neon connection string (step 1 wala)
   - `JWT_SECRET` — koi bhi lamba random string (generate karne ke liye: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `ADMIN_USERNAME` — apna login username
   - `ADMIN_PASSWORD` — apna login password
   - `NODE_ENV` = `production`
6. Deploy — 2-3 min me live ho jayega, Render tumhe URL dega (jaise `ieml-mart-days-portal.onrender.com`)

(`render.yaml` already included hai agar Render ka "Blueprint" deploy use karna ho.)

### 5. Migration production DB pe bhi chalao
Agar step 2 sirf local pe kiya tha, to production Neon DB pe bhi ek baar chalana hoga — ya to `psql` se `migrations/schema.sql` run kar do, ya local `.env` me production `DATABASE_URL` daal ke `npm run migrate` chala do (ek baar ke liye).

## Roz ka use
- **buyers** tab me search/filter kar sakte ho (buyer type, checked-in status), aur jab koi visitor actually mart pe aaye to uske row ka checkbox tick kar do — turant save ho jata hai.
- **Export CSV** button current filter ka data CSV me de deta hai.
- **Mart Owners** tab me "+ Add Mart Owner" se manually entries daal sakte ho jab list mile.
- **Analytics** tab automatically buyers table se numbers nikalta hai, kuch bhi manually update nahi karna padta.

## Agle Mart Sourcing Days ke liye
Yeh portal "IEML Mart Sourcing Days" ke liye generic hai (har mahine hone wala event) — koi date/edition hardcode nahi hai, sirf `EVENT_DATE_RANGE` env var update karte raho har baar (ya blank chhod do, sirf header pe dikhta hai, data pe koi asar nahi).

## Local run
```bash
npm install
cp .env.example .env   # values bharo
npm run migrate         # ek baar
npm start                # http://localhost:4000
```
