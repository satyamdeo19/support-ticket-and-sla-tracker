import { GraphQLError } from "graphql";

export class UnauthorizedError extends GraphQLError {
  constructor(message = "You must be logged in to perform this action.") {
    super(message, { extensions: { code: "UNAUTHORIZED" } });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, { extensions: { code: "FORBIDDEN" } });
  }
}

export class TicketNotFoundError extends GraphQLError {
  constructor(ticketId: string) {
    super(`Ticket with ID ${ticketId} not found.`, {
      extensions: { code: "TICKET_NOT_FOUND" },
    });
  }
}

export class InvalidStatusTransitionError extends GraphQLError {
  constructor(currentStatus: string, newStatus: string) {
    super(`Cannot transition ticket from ${currentStatus} to ${newStatus}.`, {
      extensions: { code: "INVALID_STATUS_TRANSITION" },
    });
  }
}
