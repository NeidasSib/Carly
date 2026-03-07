# Carly

Carly is an in progress vehicle management app built with Next.js, Supabase, and Prisma.

## Current Status

- Authentication with Supabase SSR setup
- Protected app area with sidebar navigation
- Vehicle list page with search
- Add vehicle modal with private photo upload support
- Vehicle API with create and paginated list
- Signed URL generation for private vehicle photos

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Supabase Auth and Storage
- Prisma 7 with PostgreSQL

## Features Implemented

### Auth and Protected Views

- Supabase auth is used to identify the current user.
- Protected routes render inside the protected shell layout.

### Vehicle CRUD Foundation

- Create vehicle via `POST /api/vehicles`
- List vehicles via `GET /api/vehicles?page=1&limit=10`
- List response includes pagination metadata:
  - `page`
  - `limit`
  - `total`
  - `totalPages`
  - `hasNextPage`
  - `hasPreviousPage`

### Private Photo Storage

- Vehicle photos upload to Supabase Storage bucket `vehicle-photos`.
- Current upload path format:
  - `private/{user_id}/{generated_file_name}`
- The database stores the storage object path in `Vehicle.image`.
- API `GET /api/vehicles` converts stored paths to signed URLs before returning data.

## Project Structure

- `app/(protected)/vehicle-list/page.tsx`:
  - Vehicle list UI, client side fetch, modal open state
- `components/shared/add-vehicle-modal.tsx`:
  - Vehicle form, image upload, create request
- `app/api/vehicles/route.ts`:
  - Auth checked create and paginated list endpoints
- `lib/supabase/client.ts`:
  - Browser Supabase client
- `lib/supabase/server.ts`:
  - Server Supabase client with cookie integration
- `prisma/schema.prisma`:
  - Prisma schema and `Vehicle` model

## Environment Variables

Create a `.env` file with:

```bash
DATABASE_URL=your_postgres_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
DEMO_LOGIN_EMAIL=demo_account_email_for_try_demo_button
DEMO_LOGIN_PASSWORD=demo_account_password_for_try_demo_button
```

## Setup

```bash
npm install
```

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Run development server:

```bash
npm run dev
```

## Supabase Storage Notes

Bucket name:

- `vehicle-photos` (private)

Upload path expected by current code:

- `private/{user_id}/{file_name}`

If you use Storage RLS policies based on folder segments, make sure the first folder segment is `private` and access is limited to authenticated users and their own `user_id` folder.

## API Reference

### Create Vehicle

- Method: `POST`
- Route: `/api/vehicles`
- Auth required: Yes
- Body:

```json
{
  "name": "My Car",
  "model": "Model S",
  "year": 2024,
  "license_plate": "ABC123",
  "image": "private/<user_id>/<file_name>"
}
```

### List Vehicles

- Method: `GET`
- Route: `/api/vehicles?page=1&limit=10`
- Auth required: Yes
- Returns:
  - `data`: vehicles for current user only
  - `pagination`: paging metadata

## Notes

- This project is still in active development.
- Some pages and flows are not finalized yet.
