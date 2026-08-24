roject Context: Support Ticket & SLA Tracker

## 1. Project Overview
We are building a highly strictly-typed, production-ready Support Ticket & SLA (Service Level Agreement) Tracker. The system allows users (reporters) to raise tickets and agents to work on them. 

**The core complexity lies in the SLA Engine**: SLA deadlines must be calculated strictly using **business hours only** (excluding nights, weekends, and configurable holidays) within a configurable timezone. 

## 2. Tech Stack & Runtime
- **Runtime:** Bun or Node.js
- **Language:** TypeScript (`strict: true`, absolutely `noImplicitAny`).
- **Backend API:** GraphQL Yoga (Strictly **Schema-First** using `.graphql` files and separate TS resolvers. *Do not use code-first approaches like TypeGraphQL*).
- **Database:** PostgreSQL managed via Prisma ORM. 
- **Frontend:** React + TypeScript (Vite or Next.js) with Tailwind CSS.
- **Testing:** Vitest or Jest (Unit + Database Integration tests).

## 3. Strict Architectural Guardrails
- **❌ NO scattered business logic:** The SLA calculation engine must be a dedicated, isolated, and highly testable service (e.g., `src/services/sla.service.ts`). It must *never* be implemented directly inside GraphQL resolvers.
- **❌ NO code-first GraphQL:** Define schema in `schema.graphql` and generate types.
- **❌ NO plain text passwords:** Use `argon2` or `bcrypt` for hashing.
- **✅ Server-Side Source of Truth:** All validation, status transitions, and SLA state calculations must happen on the backend. The frontend is purely for presentation.
- **✅ Machine-readable Errors:** Use standard GraphQL custom error codes (e.g., `VALIDATION_ERROR`, `TICKET_NOT_FOUND`, `INVALID_STATUS_TRANSITION`). Do not throw generic 500 errors for bad user input.

---

## 4. The SLA Engine (Core Business Logic)
The SLA Engine calculates due dates and current states based on **Business Hours**.

### Business Hours Rules:
- **Active Hours:** Monday to Friday, 09:00 – 18:00 (9 hours/day).
- **Timezone:** Configurable via environment variable (e.g., `BUSINESS_TIMEZONE=Asia/Kolkata`).
- **Exclusions:** Weekends and configurable Public Holidays contribute 0 hours.
- **Out of Hours:** Tickets created outside business hours start their clock at 09:00 of the *next valid business day*.

### SLA Policies (Default Budgets):
| Priority | First Response SLA | Resolution SLA |
|----------|--------------------|----------------|
| URGENT   | 1 business hour    | 4 business hours |
| HIGH     | 4 business hours   | 24 business hours|
| MEDIUM   | 8 business hours   | 48 business hours|
| LOW      | 24 business hours  | 72 business hours|

### SLA State Rules:
For both *First Response* and *Resolution*, the backend must calculate the state:
- `ON_TRACK`: 0% – 75% of the SLA budget consumed.
- `AT_RISK`: > 75% of the SLA budget consumed.
- `BREACHED`: > 100% (Deadline passed).

### SLA Clock Freezing:
- **First Response:** Frozen when the first comment is made by an `AGENT` (or anyone other than the reporter). Saves `firstResponseAt`.
- **Resolution:** Frozen when ticket status changes to `RESOLVED`. Saves `resolvedAt`.
- *Rule:* Once an SLA is met and frozen, it can *never* become `BREACHED` later.

---

## 5. Database Schema (Prisma Reference)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  REPORTER
  AGENT
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

model User {
  id              String    @id @default(uuid())
  name            String
  email           String    @unique
  passwordHash    String
  role            UserRole  @default(REPORTER)
  reportedTickets Ticket[]  @relation("ReportedTickets")
  assignedTickets Ticket[]  @relation("AssignedTickets")
  comments        Comment[]
  createdAt       DateTime  @default(now())
}

model Ticket {
  id              String       @id @default(uuid())
  title           String
  description     String
  priority        Priority
  status          TicketStatus @default(OPEN)
  
  reporterId      String
  reporter        User         @relation("ReportedTickets", fields: [reporterId], references: [id])
  
  assigneeId      String?
  assignee        User?        @relation("AssignedTickets", fields: [assigneeId], references: [id])
  
  comments        Comment[]
  
  createdAt       DateTime     @default(now())
  firstResponseAt DateTime?
  resolvedAt      DateTime?
}

model Comment {
  id        String   @id @default(uuid())
  content   String
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}

model Holiday {
  id   String   @id @default(uuid())
  date DateTime @unique // Stored as midnight UTC for the given day
  name String
}
6. GraphQL API Requirements
Types & Enums
Enums: Priority, TicketStatus, UserRole, SLAState (ON_TRACK, AT_RISK, BREACHED).

Types: Ticket, User, Comment, Holiday, SLAInfo, TicketDashboard, AuthPayload.

Cursor-Based Pagination
Tickets must be queryable via standard cursor pagination:

GraphQL
type TicketConnection {
  nodes: [Ticket!]!
  pageInfo: PageInfo!
}
type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}
Required Queries
tickets(status, priority, assigneeId, slaState, take, cursor): Fetch paginated, filterable tickets.

ticket(id: ID!): Fetch single ticket.

dashboard: Returns { openTickets, inProgressTickets, atRiskTickets, breachedTickets }.

users(role: UserRole)

holidays

Required Mutations
register(name, email, password, role) / login(email, password)

createTicket(title, description, priority)

assignTicket(ticketId, assigneeId)

changeTicketStatus(ticketId, status)

addComment(ticketId, content)

resolveTicket(ticketId)

7. Business Rules & Validations
Permissions:

Authenticated users can create tickets and add comments.

ONLY Agents can: Assign tickets, change status, and manually resolve tickets.

Status Transitions:

Must be enforced on the backend.

Example valid path: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED.

Prevent invalid skips (e.g., cannot go from CLOSED directly to IN_PROGRESS without explicit reopening logic, if implemented).

First Response Tracker:

Inside the addComment resolver, check if the comment author is an AGENT and if firstResponseAt is null. If so, set firstResponseAt = now().

8. Expected Project Structure
Plaintext
src/
  graphql/
    schema.graphql      # The single source of truth for the API
    resolvers/          # Typed resolvers linking to services
  services/
    sla.service.ts      # Pure business hours math. HIGHLY TESTABLE.
    ticket.service.ts   # DB ops, status transitions, validation
    auth.service.ts     # JWT, bcrypt ops
  utils/
    errors.ts           # Custom GraphQL error formatting
  server.ts             # GraphQL Yoga setup
prisma/
  schema.prisma
  seed.ts
tests/
  unit/
    sla.service.test.ts # Deep testing of dates, weekends, holidays
  integration/          # Real Postgres tests via Testcontainers or local Docker