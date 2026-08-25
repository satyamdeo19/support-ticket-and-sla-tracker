/**
 * Unit tests for ticket service business logic.
 *
 * Tests:
 *  - Ticket creation validation
 *  - Status transition rules
 *  - Authorization / first-response logic
 *  - Comment validation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, InvalidStatusTransitionError, InvalidCommentError, UserNotFoundError, TicketNotFoundError } from "../../src/utils/errors";

// ─── Mock Prisma ───────────────────────────────────────────────────────────────

// We test service logic in isolation using a lightweight mock of PrismaClient.
// The integration test (ticket.integration.test.ts) covers real DB interactions.

function makeMockPrisma(overrides: Record<string, unknown> = {}) {
  const base = {
    ticket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    holiday: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { ...base, ...overrides } as unknown as import("@prisma/client").PrismaClient;
}

// ─── Import services (after mock setup) ───────────────────────────────────────

import {
  createTicket,
  addComment,
  changeTicketStatus,
  assignTicket,
} from "../../src/services/ticket.service";

// ─── createTicket ──────────────────────────────────────────────────────────────

describe("createTicket", () => {
  it("throws VALIDATION_ERROR for empty title", async () => {
    const prisma = makeMockPrisma();
    await expect(
      createTicket(prisma, { title: "  ", description: "desc", priority: "HIGH", reporterId: "r1" })
    ).rejects.toMatchObject({ extensions: { code: "VALIDATION_ERROR" } });
  });

  it("throws VALIDATION_ERROR for empty description", async () => {
    const prisma = makeMockPrisma();
    await expect(
      createTicket(prisma, { title: "My Ticket", description: "", priority: "LOW", reporterId: "r1" })
    ).rejects.toMatchObject({ extensions: { code: "VALIDATION_ERROR" } });
  });

  it("trims whitespace from title and description before saving", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1" });

    await createTicket(prisma, {
      title: "  My Ticket  ",
      description: "  A description  ",
      priority: "MEDIUM",
      reporterId: "r1",
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "My Ticket",
          description: "A description",
        }),
      })
    );
  });

  it("creates ticket with OPEN status by default", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "OPEN" });

    await createTicket(prisma, {
      title: "Test",
      description: "Test desc",
      priority: "URGENT",
      reporterId: "r1",
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OPEN" }),
      })
    );
  });
});

// ─── addComment ────────────────────────────────────────────────────────────────

describe("addComment", () => {
  it("throws INVALID_COMMENT for empty content", async () => {
    const prisma = makeMockPrisma();
    await expect(
      addComment(prisma, { ticketId: "t1", content: "  ", authorId: "u1", authorRole: "AGENT" })
    ).rejects.toMatchObject({ extensions: { code: "INVALID_COMMENT" } });
  });

  it("throws TICKET_NOT_FOUND when ticket does not exist", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      addComment(prisma, { ticketId: "nonexistent", content: "Hello", authorId: "u1", authorRole: "AGENT" })
    ).rejects.toMatchObject({ extensions: { code: "TICKET_NOT_FOUND" } });
  });

  it("does NOT freeze firstResponseAt when reporter comments", async () => {
    const baseTicket = {
      id: "t1",
      firstResponseAt: null,
      reporterId: "r1",
    };
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseTicket);
    (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "c1",
      content: "Reporter note",
      author: { id: "r1", role: "REPORTER" },
      ticket: baseTicket,
    });

    await addComment(prisma, { ticketId: "t1", content: "Reporter note", authorId: "r1", authorRole: "REPORTER" });

    // ticket.update should NOT have been called
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("freezes firstResponseAt when first agent comment is added", async () => {
    const baseTicket = { id: "t1", firstResponseAt: null };
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(baseTicket);
    (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "c1",
      content: "Agent reply",
      author: { id: "a1", role: "AGENT" },
      ticket: baseTicket,
    });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await addComment(prisma, { ticketId: "t1", content: "Agent reply", authorId: "a1", authorRole: "AGENT" });

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firstResponseAt: expect.any(Date) }),
      })
    );
  });

  it("does NOT update firstResponseAt if already set (subsequent agent comment)", async () => {
    const alreadyResponded = { id: "t1", firstResponseAt: new Date("2024-01-08T10:00:00Z") };
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(alreadyResponded);
    (prisma.comment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "c2",
      content: "Follow-up",
      author: { id: "a1", role: "AGENT" },
      ticket: alreadyResponded,
    });

    await addComment(prisma, { ticketId: "t1", content: "Follow-up", authorId: "a1", authorRole: "AGENT" });

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});

// ─── changeTicketStatus ────────────────────────────────────────────────────────

describe("changeTicketStatus", () => {
  it("throws TICKET_NOT_FOUND when ticket does not exist", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      changeTicketStatus(prisma, { ticketId: "bad-id", status: "IN_PROGRESS" })
    ).rejects.toMatchObject({ extensions: { code: "TICKET_NOT_FOUND" } });
  });

  it("throws INVALID_STATUS_TRANSITION for CLOSED → IN_PROGRESS", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "CLOSED" });

    await expect(
      changeTicketStatus(prisma, { ticketId: "t1", status: "IN_PROGRESS" })
    ).rejects.toMatchObject({ extensions: { code: "INVALID_STATUS_TRANSITION" } });
  });

  it("throws INVALID_STATUS_TRANSITION for OPEN → CLOSED", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "OPEN" });

    await expect(
      changeTicketStatus(prisma, { ticketId: "t1", status: "CLOSED" })
    ).rejects.toMatchObject({ extensions: { code: "INVALID_STATUS_TRANSITION" } });
  });

  it("allows OPEN → IN_PROGRESS", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "OPEN" });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "IN_PROGRESS" });

    const result = await changeTicketStatus(prisma, { ticketId: "t1", status: "IN_PROGRESS" });
    expect(result.status).toBe("IN_PROGRESS");
  });

  it("allows RESOLVED → CLOSED", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "RESOLVED" });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "CLOSED" });

    const result = await changeTicketStatus(prisma, { ticketId: "t1", status: "CLOSED" });
    expect(result.status).toBe("CLOSED");
  });

  it("allows CLOSED → OPEN (reopen)", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "CLOSED" });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", status: "OPEN" });

    const result = await changeTicketStatus(prisma, { ticketId: "t1", status: "OPEN" });
    expect(result.status).toBe("OPEN");
  });
});

// ─── assignTicket ──────────────────────────────────────────────────────────────

describe("assignTicket", () => {
  it("throws TICKET_NOT_FOUND when ticket does not exist", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      assignTicket(prisma, { ticketId: "bad-id", assigneeId: "a1" })
    ).rejects.toMatchObject({ extensions: { code: "TICKET_NOT_FOUND" } });
  });

  it("throws USER_NOT_FOUND when assignee does not exist", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1" });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      assignTicket(prisma, { ticketId: "t1", assigneeId: "bad-user" })
    ).rejects.toMatchObject({ extensions: { code: "USER_NOT_FOUND" } });
  });

  it("assigns ticket successfully", async () => {
    const prisma = makeMockPrisma();
    (prisma.ticket.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1" });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1", name: "Agent" });
    (prisma.ticket.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "t1", assigneeId: "a1" });

    const result = await assignTicket(prisma, { ticketId: "t1", assigneeId: "a1" });
    expect(result.assigneeId).toBe("a1");
  });
});
