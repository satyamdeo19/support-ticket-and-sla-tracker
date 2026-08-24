import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  createTicket,
  addComment,
} from "../../src/services/ticket.service.ts";
import { hashPassword } from "../../src/services/auth.service.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

describe("Ticket Integration", () => {
  let reporterId: string;
  let agentId: string;
  let testTicketId: string;

  beforeAll(async () => {
    // Clean up before test runs
    await prisma.comment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await hashPassword("testpass");
    
    const reporter = await prisma.user.create({
      data: {
        name: "Int Reporter",
        email: "int.reporter@example.com",
        passwordHash,
        role: "REPORTER",
      },
    });
    reporterId = reporter.id;

    const agent = await prisma.user.create({
      data: {
        name: "Int Agent",
        email: "int.agent@example.com",
        passwordHash,
        role: "AGENT",
      },
    });
    agentId = agent.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.comment.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("should create a ticket programmatically", async () => {
    const ticket = await createTicket(prisma, {
      title: "Integration Test Ticket",
      description: "Testing database workflows",
      priority: "HIGH",
      reporterId,
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.status).toBe("OPEN");
    expect(ticket.firstResponseAt).toBeNull();
    testTicketId = ticket.id;
  });

  it("should add a comment as a reporter and NOT freeze firstResponseAt", async () => {
    await addComment(prisma, {
      ticketId: testTicketId,
      content: "Reporter adding some extra info",
      authorId: reporterId,
      authorRole: "REPORTER",
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });

    expect(ticket).not.toBeNull();
    expect(ticket?.firstResponseAt).toBeNull(); // Still null!
  });

  it("should add a comment as an agent and FREEZE firstResponseAt", async () => {
    await addComment(prisma, {
      ticketId: testTicketId,
      content: "Agent investigating the issue now",
      authorId: agentId,
      authorRole: "AGENT",
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
    });

    expect(ticket).not.toBeNull();
    expect(ticket?.firstResponseAt).not.toBeNull(); // Now it has a timestamp!
    expect(ticket?.firstResponseAt).toBeInstanceOf(Date);
  });
});
