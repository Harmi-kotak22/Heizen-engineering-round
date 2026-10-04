# Fernleaf Kitchen Operations Admin Panel

A role-based kitchen operations and order management system built for the **Heizen Engineering 48-hour engineering assignment**.

The system models the operational lifecycle of corporate meal orders:

```text
Catalogue
    ↓
Pricing
    ↓
Company / Employee
    ↓
Effective Menu
    ↓
Order
    ↓
Cutoff Processing
    ↓
Kitchen
    ↓
Dispatch
    ↓
Driver Delivery
    ↓
Billing
```

The implementation focuses on **correct business rules, server-side authorization, historical correctness, operational workflows, and maintainability** rather than simply building CRUD screens.

> **Live application:** [https://heizen-engineering-round.vercel.app/](https://heizen-engineering-round.vercel.app/)

> **Current status:** All major operational workflows from Catalogue through Driver Delivery have been implemented. Billing is the remaining major assignment workflow.

---

# Table of Contents

* [1. Project Overview](#1-project-overview)
* [2. Assignment Goals](#2-assignment-goals)
* [3. Technology Stack](#3-technology-stack)
* [4. Why PostgreSQL?](#4-why-postgresql)
* [5. Why NestJS + Prisma?](#5-why-nestjs--prisma)
* [6. Architecture](#6-architecture)
* [7. Core Engineering Principles](#7-core-engineering-principles)
* [8. Domain Architecture](#8-domain-architecture)
* [9. Authentication & RBAC](#9-authentication--rbac)
* [10. Catalogue & Reference Data](#10-catalogue--reference-data)
* [11. Pricing](#11-pricing)
* [12. Companies & Employees](#12-companies--employees)
* [13. Effective Menu](#13-effective-menu)
* [14. Orders](#14-orders)
* [15. Cutoff Processing](#15-cutoff-processing)
* [16. Kitchen Workflow](#16-kitchen-workflow)
* [17. Dispatch Workflow](#17-dispatch-workflow)
* [18. Driver Delivery](#18-driver-delivery)
* [19. Historical Data & Snapshots](#19-historical-data--snapshots)
* [20. Money & Pricing Correctness](#20-money--pricing-correctness)
* [21. Validation & Authorization](#21-validation--authorization)
* [22. Concurrency & Idempotency](#22-concurrency--idempotency)
* [23. Pagination & Performance](#23-pagination--performance)
* [24. Seed Data](#24-seed-data)
* [25. Feature Prioritisation](#25-feature-prioritisation)
* [26. What Was Intentionally Skipped](#26-what-was-intentionally-skipped)
* [27. Assignment Coverage](#27-assignment-coverage)
* [28. Current Implementation Status](#28-current-implementation-status)
* [29. Testing Strategy](#29-testing-strategy)
* [30. Project Structure](#30-project-structure)
* [31. Local Development](#31-local-development)
* [32. Demo Accounts](#32-demo-accounts)
* [33. Engineering Trade-offs](#33-engineering-trade-offs)
* [34. Known Limitations](#34-known-limitations)
* [35. Remaining Work](#35-remaining-work)
* [36. Future Improvements](#36-future-improvements)
* [37. Deployment](#37-deployment)
* [38. Final Design Philosophy](#38-final-design-philosophy)

---

# 1. Project Overview

Fernleaf Kitchen is an internal operations platform for managing corporate meal ordering and fulfilment.

The application supports four primary operational roles:

* **Admin**
* **Kitchen**
* **Dispatch**
* **Driver**

The system manages the complete journey from menu configuration to delivery.

The main workflows currently implemented are:

* Authentication
* Permission-based RBAC
* Reference data
* Catalogue management
* Dish options and option groups
* Portion sizes
* Pricing tiers and derived pricing
* Company management
* Employee management
* Company-specific menu visibility
* Effective employee menus
* Order creation
* Order editing
* Order placement
* Order cancellation
* Order confirmation/rejection
* Kitchen cutoff calculation
* Automatic cutoff processing
* Order history
* Historical pricing snapshots
* Kitchen preparation units
* Kitchen station routing
* Kitchen start/done workflow
* Kitchen readiness
* Dispatch workflow
* Driver assignment
* Delivery drops
* Driver's own delivery view
* Delivery completion
* Delivery notes/photo support where configured
* On-time delivery tracking

The remaining major workflow is:

```text
Billing / Internal Invoicing
```

---

# 2. Assignment Goals

The assignment is intentionally broader than a typical CRUD application.

The main engineering goals were:

1. Model the domain correctly.
2. Enforce permissions on the backend.
3. Keep business rules out of the frontend.
4. Preserve historical order information.
5. Handle money accurately.
6. Implement operational state transitions safely.
7. Support realistic seeded data.
8. Keep the architecture extensible.
9. Prioritise the most important workflows under the 48-hour constraint.
10. Clearly document decisions and trade-offs.

---

# 3. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* HTTP communication with the backend

The frontend is responsible primarily for:

* rendering workflows
* forms
* filters
* tables/boards
* user interaction
* displaying validation and API errors

The frontend does **not** own critical business rules.

---

## Backend

* NestJS
* TypeScript
* Prisma ORM
* REST APIs
* JWT authentication
* Permission-based authorization
* DTO validation

The backend owns:

* authentication
* authorization
* business rules
* order lifecycle
* pricing
* cutoff processing
* catalogue validation
* kitchen workflow
* dispatch workflow
* delivery workflow

---

## Database

* PostgreSQL
* Prisma migrations
* Prisma generated client

---

# 4. Why PostgreSQL?

PostgreSQL was selected because this application is fundamentally a **relational operational system**.

The domain contains many relationships that benefit from strong relational modelling.

For example:

```text
Company
 ├── Employees
 ├── Addresses
 ├── Holidays
 └── Orders

Dish
 ├── Categories
 ├── Allergens
 ├── Dietary Tags
 └── Option Groups
       └── Options

Order
 ├── Employee
 ├── Company
 ├── Order Lines
 ├── Kitchen Prep Units
 ├── Delivery Drop
 └── Invoice
```

## Why PostgreSQL was a good fit

### 4.1 Strong relational modelling

The system has:

* one-to-many relationships
* many-to-many relationships
* foreign keys
* unique constraints
* transactional workflows

A relational database represents these naturally.

---

### 4.2 Referential integrity

The database can enforce relationships such as:

```text
Order → Employee
Order → Company
Order Line → Dish
Kitchen Unit → Order
Company → Pricing Tier
Drop → Company
```

This reduces the possibility of orphaned or invalid records.

---

### 4.3 Transactions

Several workflows involve multiple changes that should happen together.

For example:

```text
Order becomes Confirmed
        ↓
Kitchen preparation units are created
        ↓
Order history is recorded
```

Transactions provide a safe way to keep related changes consistent.

---

### 4.4 Concurrency

Kitchen and dispatch systems are naturally concurrent.

Two staff members may attempt to:

* start the same preparation unit
* complete the same unit
* assign the same delivery
* transition the same order

PostgreSQL provides a strong foundation for transactional and atomic operations.

---

### 4.5 Exact monetary values

The system deals with:

* cost prices
* selling prices
* option charges
* order totals
* invoices

PostgreSQL's decimal/numeric support is much more appropriate for this domain than floating-point storage.

---

### 4.6 Prisma compatibility

Prisma provides a typed database layer while retaining PostgreSQL's relational capabilities.

This gives the project:

* schema-driven development
* migrations
* typed queries
* explicit relationships
* transaction support

---

# 5. Why NestJS + Prisma?

## NestJS

NestJS was selected because the application contains several distinct business domains.

The framework naturally supports:

* modules
* controllers
* services
* guards
* DTOs
* dependency injection

This maps well to the domain.

---

## Prisma

Prisma was selected because:

* the domain is highly relational
* schema relationships should remain explicit
* type-safe queries reduce data-access mistakes
* migrations make schema changes reproducible
* transactions can be used for multi-step workflows

The project uses the current Prisma generated client setup rather than relying on legacy client assumptions.

---

# 6. Architecture

The high-level architecture is:

```text
                         Browser
                            │
                            │ HTTP
                            ▼
                    Next.js Frontend
                            │
                            │ REST API
                            ▼
                     NestJS Backend
                            │
             ┌──────────────┼──────────────┐
             │              │              │
        Controllers      Guards         Services
             │                             │
             └──────────────┬──────────────┘
                            │
                          Prisma
                            │
                            ▼
                       PostgreSQL
```

The frontend does not directly access Prisma.

This follows the assignment requirement that the frontend communicate with the backend over HTTP.

---

# 7. Core Engineering Principles

## 7.1 Business rules belong on the backend

Rules such as:

* cutoff calculation
* price resolution
* menu visibility
* option validation
* order state transitions
* kitchen state transitions
* driver access

are enforced by the backend.

The frontend can improve UX by disabling controls, but that is not treated as authorization.

---

## 7.2 Permission-based authorization

The system does not depend on scattered role-name checks.

Instead, capabilities are represented using permissions.

Examples:

```text
catalogue.read
catalogue.manage

companies.read
companies.manage

employees.read
employees.manage

orders.read
orders.create
orders.manage

kitchen.read
kitchen.manage

dispatch.read
dispatch.manage

deliveries.readOwn
deliveries.manageOwn

billing.read
billing.manage

settings.read
settings.manage

dashboard.read
```

This means adding another role can primarily be handled by assigning permissions rather than changing business logic everywhere.

---

## 7.3 Historical data must remain stable

Current catalogue data and historical order data are treated differently.

Changing a dish's price today must not change yesterday's order.

Therefore important order information is stored as snapshots.

---

## 7.4 Deactivate rather than destructively delete

Operational catalogue data may be referenced by historical transactions.

Therefore dishes and other relevant entities support active/inactive states.

This preserves historical integrity.

---

## 7.5 Prefer explicit state transitions

Instead of allowing arbitrary status updates:

```text
order.status = "Delivered"
```

the application models valid transitions.

This prevents invalid operational states.

---

# 8. Domain Architecture

The implementation can be viewed as these domains:

```text
Identity / RBAC
       │
       ▼
Reference Data
       │
       ▼
Catalogue
       │
       ▼
Pricing
       │
       ▼
Companies / Employees
       │
       ▼
Effective Menu
       │
       ▼
Orders / Cutoff
       │
       ▼
Kitchen
       │
       ▼
Dispatch
       │
       ▼
Driver Delivery
       │
       ▼
Billing
```

This dependency order was also the basis for feature prioritisation.

---

# 9. Authentication & RBAC

## Implemented

* Login
* JWT authentication
* Password hashing
* Authenticated user endpoint
* Active-user validation
* Permission guards
* Role-permission mapping
* Protected backend routes

The JWT identifies the user, while backend authorization determines what that user can actually do.

---

## Roles

### Admin

Full system access.

### Kitchen

Kitchen workflow and required read-only operational information.

### Dispatch

Dispatch and delivery management.

### Driver

Own delivery workload only.

---

# 10. Catalogue & Reference Data

## Reference data

Implemented:

* Kitchen Stations
* Allergens
* Dietary Tags
* Portion Sizes

Stations include:

```text
Hot Kitchen
Cold Kitchen
Salad & Prep
Bakery & Desserts
Beverage
Unassigned
```

`Unassigned` provides a safe fallback when a dish has no configured kitchen station.

---

## Dishes

Supported information includes:

* name
* description
* image
* SKU
* hot/cold temperature
* cost price
* allergens
* dietary tags
* kitchen station
* minimum order quantity
* active/inactive state

---

## Categories

Categories support:

* ordering
* active/inactive state
* company visibility
* secret categories
* dish relationships

---

## Options

Options support:

* cost
* allergens
* dietary tags
* active/inactive state

---

## Option Groups

Option groups support:

* required/optional groups
* display ordering
* available options
* portion sizes
* size-specific extra charges
* active/inactive state

---

## Why catalogue was implemented early

Catalogue is the foundation for:

```text
Menu
Pricing
Order validation
Kitchen preparation
```

Without a reliable catalogue model, downstream workflows would have to duplicate catalogue rules.

---

# 11. Pricing

Pricing tiers have been implemented.

Example seeded tiers:

```text
Standard
Enterprise
Partner
```

One tier is designated as the default.

---

## Pricing resolution

The resolution hierarchy is:

```text
Per-item override
        ↓
Explicit/manual tier price
        ↓
Derived price
        ↓
Missing price
```

Missing pricing does **not** silently become zero.

A dish without a valid resolved price is unavailable for that pricing tier.

---

## Derived pricing

Supported derivation approaches include:

```text
Cost × multiplier
```

and:

```text
Another tier + percentage
```

Derived values are rounded **up to the next $0.05**, as required by the assignment.

---

## Why pricing was separated into its own domain

Pricing is used by:

* effective menu
* order creation
* order totals
* historical snapshots
* future billing

Putting pricing logic in one backend service prevents different workflows from calculating prices differently.

---

# 12. Companies & Employees

## Companies

Company configuration includes:

* company details
* non-public email domains
* billing contacts
* owner employee
* delivery default
* leave-before-delivery time
* packaging defaults
* driver instructions
* default driver
* pricing tier
* menu visibility
* working days
* holidays
* delivery addresses

Default leave-before-delivery time:

```text
60 minutes
```

---

## Employees

Employees belong to exactly one company.

Employee configuration includes:

* company
* active state
* ordering-related permissions
* address selection capability
* delivery time capability
* packaging capability
* allergy information
* dietary preferences

---

## Why companies/employees were implemented before orders

An order cannot be validated without knowing:

```text
Who is ordering?
      ↓
Which company?
      ↓
Which pricing tier?
      ↓
Which menu?
      ↓
Which delivery rules?
```

Therefore company and employee configuration is a prerequisite to order creation.

---

# 13. Effective Menu

The effective menu represents what an employee can **actually order**, rather than simply exposing the raw catalogue.

The flow is:

```text
Employee
   ↓
Company
   ↓
Company Pricing Tier
   ↓
Menu Visibility
   ↓
Active Catalogue
   ↓
Resolved Prices
   ↓
Effective Menu
```

The effective menu filters out:

* inactive employees
* inactive companies
* inactive categories
* inactive dishes
* inactive option groups
* inactive options
* inactive portion sizes
* company-hidden categories
* company-hidden dishes
* secret categories from normal listings
* dishes without resolved prices
* options without resolved prices

Configured ordering is preserved.

---

## Dietary/allergy information

Employee allergy and dietary information is available as employee information.

It is not automatically used to silently remove dishes from the menu.

This avoids making an implicit safety-critical filtering decision without an explicit business rule.

---

# 14. Orders

The order lifecycle is:

```text
Draft
  ↓
Placed
  ↓
Confirmed
  ↓
Delivered
```

Additional terminal/rejection states include:

```text
Cancelled
Rejected
```

---

## Order creation

The backend validates:

* employee
* company
* delivery date
* delivery schedule
* company holidays
* effective menu
* dish availability
* option availability
* required option groups
* minimum quantities
* employee permissions
* prices

Pricing is resolved server-side.

---

## Option combinations

If a dish has quantity `5`, its combinations must account for exactly five units.

Example:

```text
Combination A = 2
Combination B = 3

2 + 3 = 5
```

Valid.

But:

```text
Combination A = 2
Combination B = 2

2 + 2 = 4
```

Invalid.

This rule is enforced by the backend.

---

## Required option groups

Required groups must be satisfied.

Optional groups can be omitted.

---

## Draft workflow

Draft orders can be edited while they remain eligible.

They can subsequently be:

```text
Draft → Placed
```

or cancelled.

---

## Confirmed-order overrides

Admin can perform the explicitly allowed post-confirmation operational overrides, such as:

* delivery time
* delivery address
* packaging

These changes are represented through the existing order history mechanism.

---

# 15. Cutoff Processing

Cutoff calculation is one of the most important business rules in the application.

The conceptual calculation is:

```text
Delivery Date
      ↓
Move backwards N kitchen working days
      ↓
Apply configured cutoff time
```

Non-working days and configured kitchen holidays are skipped.

---

## Example

If:

```text
Delivery = Wednesday
Kitchen working days = Monday-Friday
Required kitchen days = 2
Cutoff = 16:00
```

then:

```text
Wednesday
   ↓
Tuesday = 1
   ↓
Monday = 2
```

Therefore:

```text
Cutoff = Monday 16:00
```

If Monday is a kitchen holiday, the calculation continues to the previous applicable working day.

---

## Cutoff state processing

Before cutoff:

```text
Draft
  → remains editable

Placed
  → remains eligible according to normal workflow
```

After cutoff:

```text
Draft
  → Cancelled

Placed
  → Confirmed
```

This is processed by the backend rather than relying on the frontend clock.

---

## Why cutoff was prioritised

Cutoff processing determines when an order becomes operationally committed.

It connects:

```text
Ordering
     ↓
Kitchen planning
     ↓
Billing
```

Therefore it is a core business rule, not a UI feature.

---

# 16. Kitchen Workflow

Kitchen workflow operates on **preparation units**, rather than treating an entire order as a single task.

The flow is:

```text
Confirmed Order
      ↓
Order Lines
      ↓
Distinct Combinations
      ↓
Kitchen Prep Units
      ↓
Station
```

---

## Preparation units

Each distinct dish/option combination becomes a preparation unit.

For example:

```text
Chicken Bowl × 3

2 × Regular + No Onion
1 × Large + Extra Sauce
```

creates distinct preparation work rather than a single undifferentiated quantity.

---

## Kitchen status

Preparation units follow:

```text
Pending
   ↓
In Progress
   ↓
Done
```

---

## Start

Starting a unit records the relevant start timestamp.

Repeated starts do not create duplicate state transitions.

---

## Done

Completing a unit records completion.

If the workflow allows finishing an unstarted unit, the implementation records the appropriate start information as part of the transition.

---

## Kitchen readiness

An order becomes Kitchen Ready only when all required preparation units are completed.

For example:

```text
Unit 1 → Done
Unit 2 → Done
Unit 3 → Pending
```

The order is not Kitchen Ready.

Once:

```text
Unit 3 → Done
```

the order can receive its kitchen-ready timestamp.

---

## Station routing

Preparation units are routed to the dish's configured kitchen station.

If no station is configured:

```text
Unassigned
```

is used.

---

## Planned readiness

The system derives operational planning times:

```text
Dispatch Ready =
Delivery Time - Company Leave-Before Minutes
```

and:

```text
Kitchen Ready =
Dispatch Ready - 30 minutes
```

Example:

```text
Delivery       12:00
Dispatch Ready 11:00
Kitchen Ready  10:30
```

---

## Why Kitchen was implemented before Dispatch

Dispatch depends on knowing that the kitchen has actually completed preparation.

Therefore the correct dependency is:

```text
Order Confirmed
      ↓
Kitchen
      ↓
Kitchen Ready
      ↓
Dispatch
```

This avoids allowing dispatch operations to operate on incomplete orders.

---

# 17. Dispatch Workflow

The dispatch lifecycle is:

```text
Kitchen Ready
      ↓
Dispatch Ready
      ↓
Out for Delivery
      ↓
Delivered
```

The backend validates the allowed transitions.

Arbitrary jumps are not allowed.

---

## Dispatch Ready

An order becomes eligible for dispatch after its kitchen preparation is complete.

Kitchen completion therefore acts as the operational boundary between kitchen and dispatch.

---

## Driver assignment

Drivers can be assigned through the dispatch workflow.

Company default driver configuration is used as the fallback where appropriate.

The conceptual resolution is:

```text
Explicit driver assignment
        ↓
Company default driver
        ↓
No driver
```

An order/drop cannot move to Out for Delivery without an available driver.

---

# 18. Driver Delivery

Drivers receive a restricted view of their delivery workload.

A Driver can access:

```text
Their own drops
+
Today's deliveries
```

The backend enforces this restriction.

Frontend filtering alone is not considered sufficient.

---

## Delivery drop grouping

Drops group deliveries using:

```text
Company
+
Address
+
Exact Delivery Date
+
Exact Delivery Time
```

This allows multiple orders for the same company/location/time to be treated as one operational delivery drop.

---

## Driver workflow

A driver can:

* view today's own drops
* view delivery information
* view delivery instructions
* see delivery time
* see associated orders
* mark a delivery as delivered
* provide delivery notes
* provide a delivery photo where supported

---

## On-time delivery

When a delivery is completed, the system records whether it was delivered on time.

This value is stored so future dashboards do not need to reinterpret historical delivery performance.

---

# 19. Historical Data & Snapshots

Historical correctness is a major design consideration.

Suppose:

```text
Dish price today = ₹250
```

An order is placed.

Later:

```text
Dish price = ₹300
```

The historical order must still show:

```text
₹250
```

Therefore order data stores relevant snapshots rather than dynamically looking up today's catalogue values.

This applies to information needed to understand historical orders, including relevant:

* dish information
* selected option information
* prices

---

# 20. Money & Pricing Correctness

Money is treated as a domain value.

The implementation avoids relying on JavaScript floating-point arithmetic for financial decisions.

Relevant values use decimal-compatible database representation.

This applies to:

* cost price
* dish price
* option charges
* derived prices
* order totals
* future invoice values

---

## Price rounding

Derived prices are rounded **up to the next $0.05**.

The distinction between:

```text
round
```

and:

```text
round up
```

is important because the assignment specifically requires the latter.

---

# 21. Validation & Authorization

Important business validation is performed on the backend.

Examples:

* inactive dishes cannot be ordered
* unavailable options cannot be selected
* required option groups must be satisfied
* combination quantities must match dish quantity
* invalid price resolution is rejected
* unauthorized users cannot perform protected operations
* drivers cannot access another driver's deliveries
* invalid order state transitions are rejected
* Out for Delivery requires a driver
* Kitchen actions operate only on valid preparation units

The frontend may display validation errors, but it is not the source of truth.

---

# 22. Concurrency & Idempotency

Operational workflows can receive duplicate or simultaneous requests.

Examples:

```text
Two kitchen users click Start
Two users click Done
A cutoff processor runs again
A dispatch transition is retried
A delivery completion request is repeated
```

The implementation therefore uses state-aware transitions and transactions where appropriate.

The goal is to prevent:

* duplicate transitions
* duplicate preparation units
* inconsistent timestamps
* invalid status jumps
* duplicate operational records

---

# 23. Pagination & Performance

List endpoints use pagination rather than returning unlimited records.

This was particularly important because the assignment explicitly expects the Kitchen board to remain usable with a significant number of orders.

The general approach is:

```text
page
limit
total
items
```

with a maximum page size.

Filtering is performed server-side where appropriate.

This keeps the application usable as operational data grows.

---

# 24. Seed Data

Seed data is an important part of the assignment because the evaluator should be able to log in and immediately explore meaningful workflows.

Seed data covers:

* roles
* permissions
* staff accounts
* stations
* allergens
* dietary tags
* portion sizes
* pricing tiers
* companies
* employees
* addresses
* catalogue
* categories
* dishes
* options
* option groups
* orders
* kitchen preparation data
* dispatch/delivery scenarios

The seed is extended additively as new workflows are implemented.

The intention is to provide realistic scenarios rather than empty CRUD tables.

---

# 25. Feature Prioritisation

The assignment contains a large number of requirements for a 48-hour implementation.

The implementation therefore followed a dependency-driven strategy.

## Phase 1 — Foundation

```text
Database
Prisma
Authentication
RBAC
Reference Data
```

### Why?

Every other feature depends on these.

---

## Phase 2 — Catalogue

```text
Categories
Dishes
Options
Option Groups
Portion Sizes
```

### Why?

Orders cannot be correctly created without a reliable representation of the menu.

---

## Phase 3 — Pricing

```text
Pricing tiers
Manual pricing
Derived pricing
Overrides
Resolution
```

### Why?

The effective menu and order creation depend on authoritative server-side pricing.

---

## Phase 4 — Companies & Employees

```text
Companies
Employees
Addresses
Working days
Holidays
Delivery defaults
Permissions
```

### Why?

The order depends on company and employee configuration.

---

## Phase 5 — Effective Menu

```text
Employee
    ↓
Company
    ↓
Visibility
    ↓
Pricing
    ↓
Effective Menu
```

### Why?

This creates a single authoritative definition of what an employee can order.

---

## Phase 6 — Orders & Cutoff

```text
Draft
 ↓
Placed
 ↓
Confirmed
```

plus cutoff processing.

### Why?

Orders are the central transaction of the system.

---

## Phase 7 — Kitchen

```text
Confirmed Order
 ↓
Prep Units
 ↓
Station
 ↓
Start
 ↓
Done
 ↓
Kitchen Ready
```

### Why?

Kitchen is the first physical fulfilment stage.

---

## Phase 8 — Dispatch & Driver

```text
Kitchen Ready
 ↓
Dispatch Ready
 ↓
Out for Delivery
 ↓
Delivered
```

### Why?

This completes the operational fulfilment chain.

---

## Phase 9 — Billing

Billing is the remaining major workflow.

It was deliberately placed after operational order fulfilment because invoice generation depends on stable confirmed order data.

---

# 26. What Was Intentionally Skipped

Not every possible feature was implemented because doing so would reduce the quality of the core workflows under the 48-hour constraint.

The skipped/deferred features fall into three categories:

1. Optional assignment features
2. Explicitly out-of-scope functionality
3. Features that add infrastructure without improving the core workflow

---

## 26.1 CSV Employee Import

**Status:** Deferred.

The assignment describes CSV import as a should-have.

Manual employee management already supports the core workflow.

CSV import would improve operational scale but does not affect:

* pricing correctness
* order correctness
* kitchen workflow
* dispatch
* delivery

Therefore it was lower priority.

---

## 26.2 Advanced Seasonal Menu Scheduling

**Status:** Not implemented.

The core menu visibility model is implemented, but advanced seasonal scheduling was not prioritised.

### Reason

It adds another date-based domain layer without being necessary for the core ordering workflow.

---

## 26.3 Employee Pause/Resume Workflow

**Status:** Not implemented.

Employee active/inactive handling covers the primary lifecycle.

A separate pause state would add complexity without being necessary for the required operational flow.

---

## 26.4 Customer-Facing Ordering

**Status:** Out of scope.

The assignment focuses on internal operations.

A customer portal would introduce:

* external authentication
* customer accounts
* customer UX
* additional security considerations
* another frontend workflow

without improving the required internal operations system.

---

## 26.5 Marketing & Promotions

**Status:** Not implemented.

No:

* coupons
* campaigns
* loyalty
* promotion engine

were introduced.

### Reason

They are unrelated to kitchen operations.

---

## 26.6 Sales Tax

**Status:** Not implemented.

### Reason

The assignment does not require tax calculation.

Adding jurisdiction-specific tax rules would create unnecessary complexity.

---

## 26.7 Delivery Fees / Zones

**Status:** Not implemented.

### Reason

The assignment does not require delivery pricing or geographic zone calculation.

---

## 26.8 Accounting Integration

**Status:** Not implemented.

### Reason

Billing is an internal operational requirement, not a complete accounting integration.

The system does not attempt to integrate with external accounting platforms.

---

## 26.9 Recipe / Ingredient Costing

**Status:** Not implemented.

The catalogue stores cost price, but the assignment does not require:

* ingredient inventory
* recipes
* stock depletion
* supplier management
* production costing

Implementing these would significantly increase domain complexity.

---

## 26.10 Notifications

**Status:** Not implemented as a core workflow.

Examples:

* email
* SMS
* push notifications

### Reason

Notifications require external infrastructure and introduce additional failure modes without being essential to the requested operational workflows.

---

## 26.11 Full Enterprise Audit Platform

**Status:** Not implemented.

Important order workflow events are recorded through the existing timeline/history model.

A separate enterprise-wide audit-log platform was not prioritised.

### Reason

The assignment needs traceability of important workflow changes, but not a complete compliance/audit infrastructure.

---

# 27. Assignment Coverage

| Assignment Requirement    | Status                             |
| ------------------------- | ---------------------------------- |
| Next.js                   | ✅ Implemented                      |
| NestJS                    | ✅ Implemented                      |
| Prisma                    | ✅ Implemented                      |
| Relational DB             | ✅ PostgreSQL                       |
| Authentication            | ✅ Implemented                      |
| Server-side RBAC          | ✅ Implemented                      |
| Admin role                | ✅ Implemented                      |
| Kitchen role              | ✅ Implemented                      |
| Dispatch role             | ✅ Implemented                      |
| Driver role               | ✅ Implemented                      |
| Reference data            | ✅ Implemented                      |
| Catalogue                 | ✅ Implemented                      |
| Dish options              | ✅ Implemented                      |
| Option groups             | ✅ Implemented                      |
| Portion sizes             | ✅ Implemented                      |
| Allergens                 | ✅ Implemented                      |
| Dietary tags              | ✅ Implemented                      |
| Company management        | ✅ Implemented                      |
| Employee management       | ✅ Implemented                      |
| Company menu visibility   | ✅ Implemented                      |
| Pricing tiers             | ✅ Implemented                      |
| Derived pricing           | ✅ Implemented                      |
| Price overrides           | ✅ Implemented                      |
| Effective menu            | ✅ Implemented                      |
| Order creation            | ✅ Implemented                      |
| Order lifecycle           | ✅ Implemented                      |
| Order snapshots           | ✅ Implemented                      |
| Cutoff calculation        | ✅ Implemented                      |
| Cutoff processing         | ✅ Implemented                      |
| Kitchen preparation units | ✅ Implemented                      |
| Kitchen station routing   | ✅ Implemented                      |
| Kitchen start/done        | ✅ Implemented                      |
| Kitchen readiness         | ✅ Implemented                      |
| Dispatch workflow         | ✅ Implemented                      |
| Driver assignment         | ✅ Implemented                      |
| Delivery drops            | ✅ Implemented                      |
| Driver own deliveries     | ✅ Implemented                      |
| Delivery completion       | ✅ Implemented                      |
| On-time delivery          | ✅ Implemented                      |
| Internal billing          | ⏳ Remaining                        |
| Invoice adjustments       | ⏳ Remaining / dependent on Billing |
| Dashboards                | 🔄 Final polish/metrics            |
| CSV employee import       | Deferred                           |
| Notifications             | Deferred                           |
| Accounting integration    | Out of scope                       |
| Customer ordering         | Out of scope                       |
| Promotions                | Out of scope                       |
| Tax engine                | Out of scope                       |
| Delivery zones/fees       | Out of scope                       |

---

# 28. Current Implementation Status

## Foundation

* [x] PostgreSQL
* [x] Prisma
* [x] Authentication
* [x] JWT
* [x] RBAC
* [x] Permission guards
* [x] Seed accounts

## Catalogue

* [x] Reference data
* [x] Categories
* [x] Dishes
* [x] Options
* [x] Option groups
* [x] Portion sizes
* [x] Allergens
* [x] Dietary tags
* [x] Kitchen stations
* [x] Active/inactive states
* [x] Company visibility

## Pricing

* [x] Pricing tiers
* [x] Default tier
* [x] Manual prices
* [x] Derived prices
* [x] Cost multiplier
* [x] Percentage derivation
* [x] Per-item overrides
* [x] Missing-price handling
* [x] $0.05 upward rounding
* [x] Effective price resolution

## Companies / Employees

* [x] Companies
* [x] Employees
* [x] Company owner
* [x] Billing contacts
* [x] Addresses
* [x] Working days
* [x] Holidays
* [x] Delivery defaults
* [x] Driver instructions
* [x] Default driver
* [x] Pricing tier assignment

## Effective Menu

* [x] Employee menu
* [x] Company visibility
* [x] Active-state filtering
* [x] Pricing resolution
* [x] Option filtering
* [x] Portion filtering
* [x] Secret category handling
* [x] Employee preview

## Orders

* [x] Order creation
* [x] Draft
* [x] Place
* [x] Cancel
* [x] Confirm
* [x] Reject
* [x] Return-to-draft where applicable
* [x] Delivery overrides
* [x] Order history
* [x] Historical snapshots
* [x] Option combination validation
* [x] Required option validation

## Cutoff

* [x] Working-day calculation
* [x] Holiday handling
* [x] Configurable cutoff
* [x] Draft cancellation after cutoff
* [x] Placed order confirmation after cutoff
* [x] Idempotent processing approach
* [x] Automated cutoff processing

## Kitchen

* [x] Prep units
* [x] Distinct combinations
* [x] Station routing
* [x] Unassigned station
* [x] Pending
* [x] In Progress
* [x] Done
* [x] Start timestamps
* [x] Completion timestamps
* [x] Kitchen Ready
* [x] Planned kitchen-ready time
* [x] Planned dispatch-ready time
* [x] Late/at-risk handling
* [x] Admin force-complete capability

## Dispatch / Driver

* [x] Kitchen Ready → Dispatch Ready
* [x] Dispatch Ready → Out for Delivery
* [x] Out for Delivery → Delivered
* [x] Delivery drops
* [x] Drop grouping
* [x] Driver assignment
* [x] Default driver fallback
* [x] Driver own-drop view
* [x] Today's deliveries
* [x] Delivery notes
* [x] Delivery photo support where configured
* [x] On-time delivery tracking

## Billing

* [ ] Internal invoice generation
* [ ] Invoice grouping
* [ ] One invoice per order constraint
* [ ] Invoice paid status
* [ ] Invoice adjustments

---

# 29. Testing Strategy

The testing approach focuses on **business-critical correctness** rather than attempting to test every simple CRUD line.

High-value business rules include:

### Authentication / RBAC

* protected endpoints
* permission enforcement
* role isolation
* Driver own-data isolation

### Pricing

* price resolution hierarchy
* derived pricing
* rounding
* missing pricing

### Orders

* option combination quantity
* required option groups
* order state transitions
* historical snapshots

### Cutoff

* working-day calculation
* holiday skipping
* cutoff boundary
* Draft → Cancelled
* Placed → Confirmed
* repeat processing/idempotency

### Kitchen

* preparation-unit creation
* station routing
* Pending → In Progress
* In Progress → Done
* completion of all units
* Kitchen Ready
* duplicate actions

### Dispatch

* valid transition ordering
* driver requirement
* driver assignment
* duplicate transition protection

### Delivery

* own-driver access
* delivery completion
* on-time calculation
* duplicate completion protection

The principle is:

> **The more financially or operationally dangerous an incorrect rule is, the more strongly it should be tested.**

---

# 30. Project Structure

The project is separated into frontend and backend applications.

Conceptually:

```text
project/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   └── src/
│       ├── auth/
│       ├── catalogue/
│       ├── pricing/
│       ├── companies/
│       ├── employees/
│       ├── orders/
│       ├── kitchen/
│       ├── dispatch/
│       └── ...
│
└── frontend/
    ├── app/
    ├── components/
    └── ...
```

The project uses domain-oriented modules without introducing unnecessary architectural layers.

---

# 31. Local Development

## Backend

```bash
cd backend
npm install
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Generate Prisma client:

```bash
npx prisma generate
```

Seed:

```bash
npm run seed
```

If the seed command is not configured:

```bash
npx tsx prisma/seed.ts
```

Start backend:

```bash
npm run start:dev
```

---

## Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local Next.js URL shown in the terminal.

---

## Prisma Studio

To inspect the database during development:

```bash
cd backend
npx prisma studio
```

This is useful for verifying:

* orders
* preparation units
* drops
* statuses
* timestamps
* seeded data
* relationships

---

# 32. Demo Accounts

The assignment-provided accounts are:

| Role     | Email               | Password    |
| -------- | ------------------- | ----------- |
| Admin    | `admin@test.com`    | `Test@1234` |
| Kitchen  | `kitchen@test.com`  | `Test@1234` |
| Dispatch | `dispatch@test.com` | `Test@1234` |
| Driver   | `driver@test.com`   | `Test@1234` |

Each account is intended to have exactly one role.

---

# 33. Engineering Trade-offs

## Why not put business logic in Next.js?

Because the backend must be the authoritative source of business rules and authorization.

It also ensures that other clients could consume the same API without duplicating business logic.

---

## Why not let the frontend calculate prices?

Because a malicious or modified client could submit a different price.

The backend resolves and validates pricing.

---

## Why not let the frontend determine cutoff?

Because client clocks and client logic cannot be trusted for business-critical decisions.

The backend determines cutoff eligibility.

---

## Why not simply change order status directly?

Because operational state transitions have prerequisites.

For example:

```text
Out for Delivery
```

should require:

* appropriate previous state
* assigned driver
* valid dispatch workflow

Explicit transitions make these rules enforceable.

---

## Why snapshots instead of live catalogue references?

Because catalogue data changes over time.

Historical orders must remain historically correct.

---

## Why not build dashboards first?

A dashboard is only as trustworthy as the data underneath it.

The implementation therefore follows:

```text
Domain Model
     ↓
Business Rules
     ↓
Operational Workflow
     ↓
Reliable Data
     ↓
Metrics
```

---

## Why defer optional features?

The assignment has a broad domain and a fixed implementation window.

A smaller number of complete workflows is more valuable than many partially implemented features.

The chosen strategy was therefore:

> Build the complete operational backbone first, then add secondary functionality.

---

# 34. Known Limitations

The current implementation is focused on the assignment scope rather than being a full production ERP/food-service platform.

Known limitations include:

* CSV employee import remains deferred.
* Advanced seasonal menu scheduling is not implemented.
* Notifications are not part of the core workflow.
* Accounting integration is not implemented.
* Customer-facing ordering is not implemented.
* Tax calculation is not implemented.
* Delivery zones/fees are not implemented.
* Recipe-level ingredient costing is not implemented.
* Full enterprise audit logging is not implemented.
* Billing remains the final major workflow to complete.

These limitations are intentional rather than accidental scope expansion.

---

# 35. Remaining Work

The remaining implementation focus is **Billing**.

The expected workflow is:

```text
Confirmed Orders
       ↓
Uninvoiced Orders
       ↓
Internal Invoice
       ↓
Invoice Paid
```

The billing implementation should build on the already-established order model rather than introducing duplicate financial information.

The remaining billing requirements include:

* confirmed orders are owed by the company
* internal invoices
* grouping confirmed uninvoiced orders
* maximum one invoice per order
* invoice totals
* invoice paid status
* financial adjustment handling
* appropriate billing permissions

After Billing, the project should undergo a final cross-domain audit covering:

* assignment requirements
* RBAC
* state transitions
* business rules
* money correctness
* concurrency
* seeded scenarios
* responsive UI
* dashboards/metrics
* deployment
* README completeness

---

# 36. Future Improvements

If additional development time were available, the following could be added:

* CSV employee import
* richer dashboards
* advanced search/filtering
* bulk catalogue operations
* stronger observability
* notifications
* richer invoice workflows
* deployment automation
* expanded integration tests
* advanced menu scheduling
* more detailed audit history

These are intentionally secondary to the required operational workflows.

---

# 37. Deployment

The final submission will provide:

* live frontend
* live backend
* production database
* seeded demo data
* Git repository
* role-specific demo accounts

The production environment will keep credentials and secrets outside source control.

The application is intended to remain available for the required evaluation period.

---

# 38. Final Design Philosophy

The project is intentionally built as a **business workflow system rather than a collection of CRUD screens**.

The most important engineering decisions are therefore around:

```text
Domain Modelling
       ↓
Authorization
       ↓
Business Rules
       ↓
State Transitions
       ↓
Historical Correctness
       ↓
Operational Workflow
       ↓
Financial Correctness
```

The implementation follows this dependency chain:

```text
Authentication / RBAC
        ↓
Reference Data
        ↓
Catalogue
        ↓
Pricing
        ↓
Companies / Employees
        ↓
Effective Menu
        ↓
Orders
        ↓
Cutoff
        ↓
Kitchen
        ↓
Dispatch
        ↓
Driver
        ↓
Billing
        ↓
Dashboards / Final Polish
```

This ordering was deliberate.

It allowed each stage to build on an already-established source of truth rather than duplicating business rules.

For example:

```text
Pricing
   ↓
Effective Menu
   ↓
Order Creation
   ↓
Order Snapshot
   ↓
Billing
```

and:

```text
Order
   ↓
Kitchen Prep Units
   ↓
Kitchen Ready
   ↓
Dispatch
   ↓
Driver Delivery
```

The project therefore prioritises **correctness and coherent end-to-end workflows over feature count**.

The remaining Billing implementation will complete the primary business lifecycle:

```text
Catalogue
    ↓
Price
    ↓
Order
    ↓
Kitchen
    ↓
Dispatch
    ↓
Delivery
    ↓
Invoice
```

Once Billing is complete, this README should be updated one final time with:

* final Billing architecture
* invoice rules
* dashboard formulas
* final test coverage
* deployment URLs
* final known limitations
* final assignment coverage
* final prioritisation/trade-off summary

---

# Appendix — One-Page Assignment Summary

## What was built?

A role-based internal kitchen operations platform supporting:

```text
Admin
Kitchen
Dispatch
Driver
```

with:

```text
Catalogue
Pricing
Companies
Employees
Effective Menu
Orders
Cutoffs
Kitchen
Dispatch
Delivery
```

## Most important engineering decisions

### PostgreSQL

Chosen because the domain is highly relational and requires:

* relationships
* constraints
* transactions
* concurrency
* decimal money

### NestJS

Chosen for modular backend business logic, guards, DTO validation and dependency injection.

### Prisma

Chosen for typed relational data access and migration management.

### Backend-owned business rules

Chosen to prevent the frontend from becoming the source of truth.

### Permission-based RBAC

Chosen instead of scattered role checks so the system can support additional roles more cleanly.

### Historical snapshots

Chosen so catalogue/pricing changes do not alter past orders.

### Explicit workflows

Chosen so invalid operational state transitions cannot be performed arbitrarily.

### Dependency-driven implementation

Chosen because of the 48-hour constraint.

The system was built from foundational data and rules toward the complete operational workflow rather than implementing isolated screens.

---

## Final Status

```text
✅ Authentication / RBAC
✅ Catalogue
✅ Pricing
✅ Companies / Employees
✅ Effective Menu
✅ Orders
✅ Cutoff
✅ Kitchen
✅ Dispatch
✅ Driver Delivery
⏳ Billing
🔄 Final audit / polish / deployment
```

**The goal is a small but coherent operations platform where the important business rules are enforced by the backend and the entire order lifecycle can be demonstrated end-to-end.**
