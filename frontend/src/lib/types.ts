// Shared GraphQL response types for the frontend.
// These mirror the GraphQL schema and eliminate the need for `any`.

export type UserRole = "REPORTER" | "AGENT";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface SLAInfo {
  state: SLAState;
  targetDate: string;
  remainingBusinessMinutes: number;
  percentageConsumed: number;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: Pick<User, "id" | "name" | "role">;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  reporter: Pick<User, "id" | "name" | "role">;
  assignee: Pick<User, "id" | "name"> | null;
  comments: Comment[];
  firstResponseSLA: SLAInfo;
  resolutionSLA: SLAInfo;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface TicketConnection {
  nodes: Ticket[];
  pageInfo: PageInfo;
}

export interface TicketDashboard {
  openTickets: number;
  inProgressTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
}
