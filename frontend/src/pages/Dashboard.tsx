import { useState } from "react";
import { useQuery } from "urql";
import { Link } from "react-router-dom";
import { Plus, LayoutDashboard, Clock, AlertTriangle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent } from "../components/ui/Card";
import { CreateTicketModal } from "../components/CreateTicketModal";
import { formatDate } from "../lib/utils";

const DASHBOARD_QUERY = `
  query GetDashboard {
    dashboard {
      openTickets
      inProgressTickets
      atRiskTickets
      breachedTickets
    }
  }
`;

const TICKETS_QUERY = `
  query GetTickets($status: TicketStatus, $priority: Priority, $cursor: String, $take: Int) {
    tickets(status: $status, priority: $priority, cursor: $cursor, take: $take) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        status
        priority
        createdAt
        reporter { name }
        assignee { name }
        firstResponseSLA { state targetDate }
        resolutionSLA { state targetDate }
      }
    }
  }
`;

function SLAStateBadge({ state, targetDate }: { state: string; targetDate: string }) {
  const isPast = new Date(targetDate) < new Date();
  const dateStr = formatDate(targetDate);
  
  if (state === "BREACHED") return <Badge variant="danger">🔴 Breached</Badge>;
  if (state === "AT_RISK") return <Badge variant="warning">🟠 At Risk ({dateStr})</Badge>;
  return <Badge variant="success">🟢 On Track</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "URGENT": return <Badge variant="danger">Urgent</Badge>;
    case "HIGH": return <Badge variant="warning">High</Badge>;
    case "MEDIUM": return <Badge variant="default">Medium</Badge>;
    default: return <Badge variant="neutral">Low</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "OPEN": return <Badge variant="default">Open</Badge>;
    case "IN_PROGRESS": return <Badge variant="warning">In Progress</Badge>;
    case "RESOLVED": return <Badge variant="success">Resolved</Badge>;
    default: return <Badge variant="neutral">Closed</Badge>;
  }
}

export function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);

  const [{ data: dashboardData, fetching: dashboardFetching }] = useQuery({
    query: DASHBOARD_QUERY,
    requestPolicy: "cache-and-network",
  });

  const [{ data: ticketsData, fetching: ticketsFetching }, executeTicketsQuery] = useQuery({
    query: TICKETS_QUERY,
    variables: { 
      status: statusFilter || undefined, 
      priority: priorityFilter || undefined,
      take: 10,
      cursor
    },
  });

  const refresh = () => {
    executeTicketsQuery({ requestPolicy: "network-only" });
  };

  const handleNextPage = () => {
    if (ticketsData?.tickets.pageInfo.hasNextPage) {
      setCursor(ticketsData.tickets.pageInfo.endCursor);
    }
  };

  const handleResetPagination = () => {
    setCursor(null);
  };

  const stats = dashboardData?.dashboard;
  const tickets = ticketsData?.tickets.nodes || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your support operations and SLA compliance.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Open Tickets</p>
              <p className="text-2xl font-bold text-slate-900">
                {dashboardFetching ? "-" : stats?.openTickets || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">In Progress</p>
              <p className="text-2xl font-bold text-slate-900">
                {dashboardFetching ? "-" : stats?.inProgressTickets || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">SLA At Risk</p>
              <p className="text-2xl font-bold text-slate-900">
                {dashboardFetching ? "-" : stats?.atRiskTickets || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">SLA Breached</p>
              <p className="text-2xl font-bold text-slate-900">
                {dashboardFetching ? "-" : stats?.breachedTickets || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 bg-slate-50/50 rounded-t-xl">
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); handleResetPagination(); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select 
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); handleResetPagination(); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-medium">Ticket</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium">Assignee</th>
                <th className="px-6 py-4 font-medium">SLA State</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFetching && tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Loading tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket: any) => (
                  <tr key={ticket.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 line-clamp-1">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mt-1">Created {formatDate(ticket.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={ticket.status} /></td>
                    <td className="px-6 py-4"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-6 py-4 text-slate-600">{ticket.assignee?.name || "Unassigned"}</td>
                    <td className="px-6 py-4">
                      <SLAStateBadge 
                        state={ticket.resolutionSLA.state} 
                        targetDate={ticket.resolutionSLA.targetDate} 
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/tickets/${ticket.id}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          View <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30 rounded-b-xl">
          <p className="text-sm text-slate-500">
            {cursor ? "Showing next page" : "Showing first page"}
          </p>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={!cursor} onClick={handleResetPagination}>
               First Page
             </Button>
             <Button variant="outline" size="sm" disabled={!ticketsData?.tickets.pageInfo.hasNextPage} onClick={handleNextPage}>
               Next Page
             </Button>
          </div>
        </div>
      </Card>

      <CreateTicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
