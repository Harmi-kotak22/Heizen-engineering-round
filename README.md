# Fernleaf Kitchen Operations

A full-stack operations panel for a meal-preparation business. It supports the
core flow from maintaining the catalogue and company settings through ordering,
kitchen preparation, dispatch, and driver delivery.

This README is the shared project overview. The implementation is evolving;
update the **Implementation status** and **Deferred scope** sections as work is
completed or priorities change.

## Contents

- [What the application does](#what-the-application-does)
- [Implementation status](#implementation-status)
- [Why PostgreSQL](#why-postgresql)
- [Architecture and technology](#architecture-and-technology)
- [Run locally](#run-locally)
- [Permissions and operational safeguards](#permissions-and-operational-safeguards)
- [Deferred scope](#deferred-scope)
- [Validation](#validation)
- [Keeping this README current](#keeping-this-readme-current)

## What the application does

The application brings the main kitchen operations workflow into one place:

1. Configure reference data, menu items, companies, employees, delivery
   addresses, and pricing.
2. Build an effective menu using the catalogue, visibility, and pricing rules.
3. Create and manage orders for delivery.
4. Prepare confirmed orders through kitchen prep units.
5. Group ready orders into delivery drops, assign drivers, and complete
   deliveries.

The UI is organized around the work each role needs to perform rather than
around a single generic dashboard.

## Implementation status

The following areas are present in the current application:

| Area | Current capabilities |
| --- | --- |
| Authentication and access control | JWT-based sign-in; role permissions enforced by backend guards |
| Reference data | Shared catalogue/reference data used by the operational modules |
| Catalogue | Categories, dishes, options, and dish details |
| Pricing | Pricing tiers and dish pricing |
| Companies and employees | Company and employee management, addresses, delivery calendars, menu visibility, and company delivery preferences |
| Effective menu | Menu view reflecting the applicable company/employee visibility and pricing |
| Orders | Order creation and management, order details, and lifecycle controls |
| Kitchen | Kitchen work organized around preparation units and stations; prep completion feeds dispatch readiness |
| Dispatch | Filterable drop board, driver assignment, and guarded dispatch status transitions |
| Driver deliveries | Logged-in drivers see their own drops scheduled for today, ordered by delivery time, and can record delivery completion |

### Dispatch and driver workflow

The delivery lifecycle is:

```text
Kitchen Ready -> Dispatch Ready -> Out for Delivery -> Delivered
```

- Only confirmed orders with completed preparation can be marked Dispatch
  Ready.
- A drop groups orders for the same company, address, delivery date, and
  delivery time. The database enforces uniqueness for that combination.
- A drop uses an explicitly assigned driver first, then the company's
  configured default driver; it remains unassigned if neither is available.
- Sending a drop out for delivery requires a driver.
- Delivery completion is accepted only from Out for Delivery. A driver must be
  assigned to the drop, unless an authorized dispatch manager is performing
  the delivery completion.
- Driver access is restricted by the backend to that driver's own drops for
  the current business date. The business timezone comes from kitchen settings.
- The backend stores the delivered timestamp and calculates/stores whether it
  was on time against the planned delivery date and time in the configured
  timezone.
- A delivery note and optional photo/reference URL can be recorded. There is
  no photo-upload or file-storage service in the current implementation.

## Why PostgreSQL

PostgreSQL is the database configured by the Prisma schema. It is a good fit
for this application's data and workflow requirements:

- **Relational business data:** Orders connect to companies, employees,
  addresses, order lines, options, prep units, and delivery drops. Relational
  constraints make those associations explicit and maintainable.
- **Consistent workflow changes:** Operations such as updating a drop and
  recording order events involve related records. Database transactions help
  keep those changes together rather than leaving partially updated workflow
  state.
- **Enforceable business rules:** Unique keys and foreign keys can enforce
  rules such as one drop per company/address/date/time combination and valid
  references between records.
- **Precise operational values:** PostgreSQL supports the decimal values used
  for menu and order pricing, as well as date, time, and timestamp data needed
  for delivery planning and performance records.
- **Mature ecosystem:** PostgreSQL is widely supported and works with the
  project's Prisma data-access layer and PostgreSQL driver/adapter.

These are the reasons PostgreSQL fits the implemented domain; the schema
declares PostgreSQL as its datasource, so running the application requires a
reachable PostgreSQL database.

## Architecture and technology

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Backend API | NestJS, TypeScript |
| Database and ORM | PostgreSQL, Prisma |
| Authentication | JWT access tokens |
| Authorization | Database-backed roles and permissions, checked by backend guards |
| Tests | Vitest |

The repository keeps the frontend and backend in separate project folders:

```text
frontend/   Next.js application
backend/    NestJS API, Prisma schema, migrations, and seed data
```

## Run locally

### Prerequisites

- Node.js and npm
- A PostgreSQL database

### Configure the backend

Create `backend/.env` (this file is ignored by Git) with:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

Use a secret manager or local environment file for credentials. Do not commit
database credentials or real secrets.

Install dependencies, generate the Prisma client, and apply migrations:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

The API listens on port `3001` by default.

### Configure and run the frontend

In another terminal:

```powershell
cd frontend
npm install
```

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Then start the frontend:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Permissions and operational safeguards

Permissions are stored in the database and checked by the backend. Hiding a
page or button in the frontend is not treated as an authorization boundary.
Dispatch and driver operations use these permissions:

| Permission | Purpose |
| --- | --- |
| `dispatch.read` | View the dispatch board |
| `dispatch.manage` | Assign drivers and manage dispatch operations; also permits authorized administrative delivery completion |
| `deliveries.readOwn` | View the authenticated driver's assigned deliveries |
| `deliveries.manageOwn` | Complete deliveries assigned to the authenticated driver |

The dispatch endpoints validate allowed state transitions and preparation
readiness server-side. Driver delivery queries are scoped by the authenticated
user on the backend, not just filtered in the browser.

## Deferred scope

The current delivery-focused implementation intentionally does not include:

- **Billing and invoicing workflows:** Although billing-related schema and
  permissions exist, there is no complete user-facing billing workflow in the
  current application. It is separate from getting the operational
  order-to-delivery path working and is not part of the current dispatch/driver
  scope.
- **Dashboards and analytics:** These are deferred until operational data and
  workflows are established; on-time delivery is stored now so it can support
  later reporting.
- **Notifications:** Email, SMS, or push notifications are not required to
  execute the current workflow and would add external delivery/integration
  concerns.
- **CSV import:** Manual management is available in the relevant areas; bulk
  import, validation, and error-recovery behavior are a distinct feature.
- **Photo upload/storage:** The delivery record accepts an optional photo or
  reference URL, but the application does not currently upload or host image
  files.

These items are deferred rather than represented as completed functionality.
They can be added in future work without changing the documented current
capabilities until implemented and verified.

## Validation

Run checks from the relevant project directory:

```powershell
# Backend tests and production compilation
cd backend
npm test
npm run build

# Frontend production compilation
cd frontend
npm run build
```

The dispatch service tests can be run on their own:

```powershell
cd backend
npm test -- --run src/dispatch/dispatch.service.spec.ts
```

## Keeping this README current

For each later feature update:

1. Add it to **Implementation status** only after it is implemented.
2. Document important workflow rules, permissions, or operational caveats.
3. Remove or revise it in **Deferred scope** when it is delivered.
4. Update setup and validation commands when project scripts or configuration
   change.
