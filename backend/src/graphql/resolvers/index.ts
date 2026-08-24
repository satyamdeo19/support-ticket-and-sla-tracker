/**
 * Resolver index — merges all resolver maps.
 * Import this single object in server.ts.
 *
 * Queries that aren't implemented yet throw a clear NOT_IMPLEMENTED error
 * so GraphiQL gives useful feedback rather than silent null returns.
 *
 * As each feature is implemented (Step 4, Step 5…), replace the stub
 * with the real resolver and import the resolver file here.
 */

import { GraphQLError } from "graphql";
import { authResolvers } from "./auth.resolvers.ts";

// Reusable stub for unimplemented resolvers
const notImplemented = (): never => {
  throw new GraphQLError("This resolver is not yet implemented.", {
    extensions: { code: "NOT_IMPLEMENTED" },
  });
};

export const resolvers = {
  Query: {
    tickets: notImplemented,
    ticket: notImplemented,
    dashboard: notImplemented,
    users: notImplemented,
    holidays: notImplemented,
  },

  Mutation: {
    ...authResolvers.Mutation,

    // Ticket mutations — implemented in Step 4
    createTicket: notImplemented,
    assignTicket: notImplemented,
    changeTicketStatus: notImplemented,
    addComment: notImplemented,
    resolveTicket: notImplemented,
    addHoliday: notImplemented,
  },
};
