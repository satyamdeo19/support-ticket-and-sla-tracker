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

import { authResolvers } from "./auth.resolvers.ts";
import { ticketResolvers } from "./ticket.resolvers.ts";

export const resolvers = {
  Query: {
    ...ticketResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...ticketResolvers.Mutation,
  },
  
  Ticket: ticketResolvers.Ticket,
};
