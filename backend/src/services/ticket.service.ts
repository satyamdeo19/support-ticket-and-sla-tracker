import { PrismaClient, TicketStatus, Priority, UserRole, Ticket } from "@prisma/client";
import { InvalidStatusTransitionError, TicketNotFoundError } from "../utils/errors.ts";
import {
  SLA_POLICIES,
  calculateSLATargetDate,
  calculateSLAStatus,
} from "./sla.service.ts";

// Helper to get active holidays as Dates
async function getHolidays(prisma: PrismaClient): Promise<Date[]> {
  const holidays = await prisma.holiday.findMany();
  return holidays.map((h) => new Date(h.date));
}

// Allowed status transitions
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["OPEN", "RESOLVED"],
  RESOLVED: ["OPEN", "CLOSED"], // Reopen or close
  CLOSED: ["OPEN"], // Reopen
};

export async function createTicket(
  prisma: PrismaClient,
  data: {
    title: string;
    description: string;
    priority: Priority;
    reporterId: string;
  }
) {
  const now = new Date();
  
  // Actually, we don't need to calculate the target date and save it to the DB for SLA.
  // Wait, does the DB schema have SLA fields? Let me check schema.prisma. 
  // No, the context.md says: Computed SLA fields (resolved server-side).
  // I will just create the ticket.

  return prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: "OPEN",
      reporterId: data.reporterId,
    },
    include: {
      reporter: true,
      assignee: true,
      comments: { include: { author: true } },
    }
  });
}

export async function addComment(
  prisma: PrismaClient,
  data: {
    ticketId: string;
    content: string;
    authorId: string;
    authorRole: UserRole;
  }
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
  });

  if (!ticket) {
    throw new TicketNotFoundError(data.ticketId);
  }

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      authorId: data.authorId,
      ticketId: data.ticketId,
    },
    include: {
      author: true,
      ticket: {
        include: {
            reporter: true,
            assignee: true,
            comments: { include: { author: true } }
        }
      }
    }
  });

  // Freeze firstResponseAt if this is the first agent comment
  if (data.authorRole === "AGENT" && !ticket.firstResponseAt) {
    await prisma.ticket.update({
      where: { id: data.ticketId },
      data: { firstResponseAt: new Date() },
    });
  }

  return comment;
}

export async function changeTicketStatus(
  prisma: PrismaClient,
  data: {
    ticketId: string;
    status: TicketStatus;
  }
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
  });

  if (!ticket) {
    throw new TicketNotFoundError(data.ticketId);
  }

  const allowedNextStatuses = VALID_TRANSITIONS[ticket.status];
  if (!allowedNextStatuses.includes(data.status)) {
    throw new InvalidStatusTransitionError(ticket.status, data.status);
  }

  // If changing to RESOLVED, use resolveTicket logic
  if (data.status === "RESOLVED") {
    return resolveTicket(prisma, { ticketId: data.ticketId });
  }

  // If changing from RESOLVED to something else, we might need to un-freeze resolvedAt
  // Depending on business rules, reopening a ticket might clear resolvedAt.
  const updateData: any = { status: data.status };
  if (ticket.status === "RESOLVED" && data.status !== "CLOSED") {
      updateData.resolvedAt = null;
  }

  return prisma.ticket.update({
    where: { id: data.ticketId },
    data: updateData,
    include: {
      reporter: true,
      assignee: true,
      comments: { include: { author: true } },
    }
  });
}

export async function resolveTicket(
  prisma: PrismaClient,
  data: { ticketId: string }
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
  });

  if (!ticket) {
    throw new TicketNotFoundError(data.ticketId);
  }

  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      // Already resolved or closed, just return
      return ticket;
  }

  const allowedNextStatuses = VALID_TRANSITIONS[ticket.status];
  if (!allowedNextStatuses.includes("RESOLVED")) {
    throw new InvalidStatusTransitionError(ticket.status, "RESOLVED");
  }

  return prisma.ticket.update({
    where: { id: data.ticketId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
    include: {
      reporter: true,
      assignee: true,
      comments: { include: { author: true } },
    }
  });
}

export async function assignTicket(
  prisma: PrismaClient,
  data: { ticketId: string; assigneeId: string }
) {
    const ticket = await prisma.ticket.findUnique({
        where: { id: data.ticketId },
    });
    
    if (!ticket) {
        throw new TicketNotFoundError(data.ticketId);
    }

    return prisma.ticket.update({
        where: { id: data.ticketId },
        data: { assigneeId: data.assigneeId },
        include: {
            reporter: true,
            assignee: true,
            comments: { include: { author: true } },
        }
    });
}

export async function computeTicketSLA(
  prisma: PrismaClient,
  ticket: Ticket,
  timezone: string = "UTC"
) {
  const holidays = await getHolidays(prisma);
  const policies = SLA_POLICIES[ticket.priority as keyof typeof SLA_POLICIES];

  // First Response SLA
  // If firstResponseAt is set, we calculate status relative to that time (frozen).
  // Otherwise, we calculate relative to now.
  const firstResponseNow = ticket.firstResponseAt || new Date();
  const firstResponseSLA = calculateSLAStatus(
    ticket.createdAt,
    policies.firstResponseHours,
    holidays,
    timezone,
    firstResponseNow
  );

  // Resolution SLA
  // If resolvedAt is set, calculate status relative to that time (frozen).
  // Otherwise, relative to now.
  const resolutionNow = ticket.resolvedAt || new Date();
  const resolutionSLA = calculateSLAStatus(
    ticket.createdAt,
    policies.resolutionHours,
    holidays,
    timezone,
    resolutionNow
  );

  return {
    firstResponseSLA: {
      ...firstResponseSLA,
      targetDate: firstResponseSLA.targetDate.toISOString(),
    },
    resolutionSLA: {
      ...resolutionSLA,
      targetDate: resolutionSLA.targetDate.toISOString(),
    },
  };
}

export async function getTickets(
    prisma: PrismaClient,
    filters: {
        status?: TicketStatus;
        priority?: Priority;
        assigneeId?: string;
    },
    pagination: {
        take: number;
        cursor?: string;
    }
) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    const tickets = await prisma.ticket.findMany({
        where,
        take: pagination.take + 1, // Fetch one extra to determine hasNextPage
        ...(pagination.cursor && {
            skip: 1,
            cursor: { id: pagination.cursor }
        }),
        orderBy: { createdAt: 'desc' },
        include: {
            reporter: true,
            assignee: true,
            comments: { include: { author: true } }
        }
    });

    let hasNextPage = false;
    let endCursor = null;

    if (tickets.length > pagination.take) {
        hasNextPage = true;
        tickets.pop(); // Remove the extra ticket
    }

    if (tickets.length > 0) {
        endCursor = tickets[tickets.length - 1].id;
    }

    return {
        nodes: tickets,
        pageInfo: {
            hasNextPage,
            endCursor,
        }
    };
}
