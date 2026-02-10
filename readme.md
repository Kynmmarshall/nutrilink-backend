# NutriLink Backend

Node.js + TypeScript API for the NutriLink food redistribution platform. It powers provider listings, beneficiary requests, delivery workflows, and admin analytics against a PostgreSQL database.

## Tech Stack
- **Node.js 20** with **Express 4**
- **Prisma ORM** connected to PostgreSQL
- **TypeScript** + ESLint + Prettier
- **Zod** for runtime validation
- **JWT** authentication with role-based guards
- Optional **Docker** support (see below)

## Prerequisites
- Node.js 20+
- PostgreSQL 16+ (already running on the VPS)
- pnpm/npm/yarn (examples use `npm`)

## Getting Started
1. Copy the sample environment file and update secrets (database URL, JWT secrets, `ADMIN_ACCESS_CODE` that unlocks admin sign-ups):
	```bash
	cp .env.example .env
	# edit DATABASE_URL, JWT secrets, port, etc.
	```
2. Install dependencies:
	```bash
	npm install
	```
3. Generate the Prisma client and sync schema (safe because tables already exist):
	```bash
	npx prisma generate
	npx prisma db push
	```
4. Seed reference data (creates demo accounts/passwords `ChangeMe123!`):
	```bash
	npm run prisma:seed
	```
5. Start the dev server:
	```bash
	npm run dev
	```
	The API listens on `http://localhost:4000` by default.

## Key NPM scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` | Start in watch mode via `tsx` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled code (production) |
| `npm run lint` / `npm run format` | Quality checks |
| `npm run prisma:*` | Prisma helpers (generate/migrate/seed) |

## API Highlights
- `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/refresh`
- `GET /api/listings` for the public feed, `POST /api/listings` for providers
- `POST /api/requests` + status transitions for providers/beneficiaries/admins
- `GET /api/deliveries/tasks/available`, `POST /api/deliveries/:requestId/accept`
- `GET /api/admin/analytics/summary` for platform metrics
- `GET /api/users` to power the community map, `PUT /api/users/:id` and `POST /api/users/:id/change-password` for profile management

All protected endpoints expect `Authorization: Bearer <token>` with roles (`provider`, `beneficiary`, `delivery`, `admin`). Registration now captures `phoneNumber` plus latitude/longitude to support the community map shown in the Flutter app.

## Docker (optional)
Create a `Dockerfile`/`docker-compose.yml` if you want containerized deployment. A typical pattern:
```bash
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/server.js"]
```
Be sure to mount/forward environment variables for database access.

## Deployment Checklist
- Set `NODE_ENV=production` and strong JWT secrets.
- Ensure PostgreSQL only accepts local connections (already true on the VPS).
- Run `npm run build` then `npm start` behind a process manager (PM2/systemd) or container.
- Configure reverse proxy (Nginx/Caddy) and HTTPS.

## Testing the API Quickly
Use any REST client or curl:
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nutrilink.com","password":"ChangeMe123!"}'
```
Response includes `tokens.accessToken` which can call protected routes.

---
Need changes or extra endpoints? Let me know which flows to prioritize next (e.g., notifications, geo search, webhooks).