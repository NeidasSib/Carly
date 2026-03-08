# Carly

Carly is a vehicle management app with personal and company workspaces. Manage vehicles, compliance dates, assignments, and bookings in one place. Built with Next.js, Supabase, and Prisma.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4, shadcn/ui, Framer Motion
- Supabase (Auth, Storage)
- Prisma 7 with PostgreSQL

## Features

- **Auth:** Sign up, sign in, email confirmation, forgot password, optional demo login
- **Workspaces:** Personal (your vehicles) and company (shared fleet); switch via sidebar
- **Vehicles:** Add, list (paginated search), view details, edit, delete; VIN, fuel type, transmission; compliance dates (insurance, inspection, road tax)
- **Photos:** Private uploads to Supabase Storage; signed URLs for display
- **Assignments:** Assign vehicles to users for a date range (personal or company); overlap checks
- **Companies:** Create company, manage members (owner/admin/member), one-time invite links, delete company (owner only)
- **Bookings:** Company tab to create and manage vehicle reservations with overlap validation
- **Calendar:** View bookings and compliance due dates by day
- **Dashboard:** KPIs, urgent compliance, today’s assignments, recent vehicle updates; inline compliance date updates
- **Profile:** Display name, avatar, account deletion (with password confirmation)
- **Limits:** Up to 20 vehicles per workspace; demo account cannot create/delete companies or delete itself

## Environment Variables

Create a `.env` file (and set the same in your host for production):

```bash
DATABASE_URL=your_postgres_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
DEMO_LOGIN_EMAIL=demo_account_email_for_try_demo_button
DEMO_LOGIN_PASSWORD=demo_account_password_for_try_demo_button
```

Optional (for account deletion):

```bash
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

- **DATABASE_URL:** PostgreSQL connection string (use a connection pooler in production for serverless).
- **NEXT_PUBLIC_***: From Supabase project settings.
- **DEMO_***: Only needed if you use the “Try Demo” button on the login page.
- **SUPABASE_SERVICE_ROLE_KEY:** Required for the profile account-deletion flow; from Supabase project settings (keep secret).

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to sign in.

## Deploy (e.g. Vercel)

1. **Build:** Ensure Prisma client is generated before the Next.js build, e.g. in `package.json`:  
   `"build": "prisma generate && next build"`  
   or add `"postinstall": "prisma generate"`.

2. **Env:** Set all variables above in your host (Vercel: Project → Settings → Environment Variables). Use your **production** database URL; a pooler URL is recommended for serverless.

3. **Migrations:** Run once against production:  
   `DATABASE_URL="your_production_url" npx prisma migrate deploy`  
   Re-run after adding new migrations.

4. **Supabase:** In Authentication → URL Configuration, add your production site URL (e.g. `https://your-app.vercel.app`) to redirect allow list so auth callbacks work.

## Supabase Storage

- **Bucket:** `vehicle-photos` (private).
- **Paths:** `private/{user_id}/{file_name}` for vehicle photos; `private/{user_id}/profile/...` for avatars.
- RLS should restrict access to authenticated users and their own `user_id` folder.

## Project Structure (main areas)

- `app/(protected)/` – Dashboard, vehicle list/detail, calendar, bookings, company, profile
- `app/api/` – Vehicles, companies, members, invites, bookings, dashboard, calendar, profile, auth (demo login)
- `app/auth/` – Login, sign up, confirm, error, forgot/update password, invite accept, setup profile
- `components/` – UI (shadcn), forms, sidebar, vehicle card/details/assignments, modals
- `lib/` – Prisma client, Supabase client/server/middleware, workspace helpers, demo check
- `prisma/` – Schema and migrations
