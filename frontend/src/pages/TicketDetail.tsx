import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "urql";
import toast from "react-hot-toast";
import { ArrowLeft, Clock, Send, CheckCircle2, UserPlus, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatDate, cn } from "../lib/utils";
import { getAuthToken, decodeToken } from "../lib/graphql";
import type { Ticket, Comment, TicketStatus, User } from "../lib/types";

// Allowed next statuses per current status (mirrors backend VALID_TRANSITIONS)
const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["OPEN", "RESOLVED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
};

const TICKET_QUERY = `
  query GetTicket($id: ID!) {
    ticket(id: $id) {
      id title description status priority createdAt
      reporter { name id role }
      assignee { name id }
      resolutionSLA { state targetDate remainingBusinessMinutes }
      firstResponseSLA { state targetDate remainingBusinessMinutes }
      comments { id content createdAt author { name role id } }
    }
  }
`;

const USERS_QUERY = `
  query GetAgents { users(role: AGENT) { id name } }
`;

const ADD_COMMENT_MUTATION = `
  mutation AddComment($ticketId: ID!, $content: String!) {
    addComment(ticketId: $ticketId, content: $content) { id }
  }
`;

const RESOLVE_TICKET_MUTATION = `
  mutation ResolveTicket($ticketId: ID!) {
    resolveTicket(ticketId: $ticketId) { id status }
  }
`;

const ASSIGN_TICKET_MUTATION = `
  mutation AssignTicket($ticketId: ID!, $assigneeId: ID!) {
    assignTicket(ticketId: $ticketId, assigneeId: $assigneeId) { id assignee { id name } }
  }
`;

const CHANGE_STATUS_MUTATION = `
  mutation ChangeTicketStatus($ticketId: ID!, $status: TicketStatus!) {
    changeTicketStatus(ticketId: $ticketId, status: $status) { id status }
  }
`;

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  // Decode JWT to surface current user role for UI hints (backend still enforces auth)
  const currentUser = decodeToken(getAuthToken());
  const isAgent = currentUser?.role === "AGENT";

  const [{ data, fetching }, executeQuery] = useQuery<{ ticket: Ticket | null }>({
    query: TICKET_QUERY,
    variables: { id },
  });

  const [{ data: usersData }] = useQuery<{ users: Array<Pick<User, "id" | "name">> }>({
    query: USERS_QUERY,
    pause: !isAgent,
  });

  const [{ fetching: addingComment }, addComment] = useMutation(ADD_COMMENT_MUTATION);
  const [{ fetching: resolvingTicket }, resolveTicket] = useMutation(RESOLVE_TICKET_MUTATION);
  const [{ fetching: assigningTicket }, assignTicket] = useMutation(ASSIGN_TICKET_MUTATION);
  const [{ fetching: changingStatus }, changeStatus] = useMutation(CHANGE_STATUS_MUTATION);

  if (fetching && !data) {
    return <div className="p-8 text-center text-slate-500">Loading ticket details...</div>;
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return <div className="p-8 text-center text-red-500">Ticket not found</div>;
  }

  const agents = usersData?.users ?? [];
  const nextStatuses = NEXT_STATUSES[ticket.status];
  const canAct = ticket.status !== "CLOSED";

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const res = await addComment({ ticketId: ticket.id, content: commentText });
    if (res.error) {
      toast.error(res.error.graphQLErrors[0]?.message ?? res.error.message);
    } else {
      setCommentText("");
      executeQuery({ requestPolicy: "network-only" });
    }
  };

  const handleResolve = async () => {
    const res = await resolveTicket({ ticketId: ticket.id });
    if (res.error) {
      toast.error(res.error.graphQLErrors[0]?.message ?? res.error.message);
    } else {
      toast.success("Ticket resolved!");
      executeQuery({ requestPolicy: "network-only" });
    }
  };

  const handleAssign = async () => {
    const assigneeId = selectedAssignee || currentUser?.userId;
    if (!assigneeId) return;
    const res = await assignTicket({ ticketId: ticket.id, assigneeId });
    if (res.error) {
      toast.error(res.error.graphQLErrors[0]?.message ?? res.error.message);
    } else {
      toast.success("Ticket assigned!");
      setSelectedAssignee("");
      executeQuery({ requestPolicy: "network-only" });
    }
  };

  const handleChangeStatus = async (status: TicketStatus) => {
    if (status === "RESOLVED") return handleResolve();
    const res = await changeStatus({ ticketId: ticket.id, status });
    if (res.error) {
      toast.error(res.error.graphQLErrors[0]?.message ?? res.error.message);
    } else {
      toast.success(`Status changed to ${status.replace("_", " ")}`);
      executeQuery({ requestPolicy: "network-only" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </button>

      {/* Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ticket.title}</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              Reported by <span className="font-medium text-slate-900">{ticket.reporter.name}</span>
              <span>•</span>
              {formatDate(ticket.createdAt)}
              {ticket.assignee && (
                <>
                  <span>•</span>
                  Assigned to <span className="font-medium text-slate-900">{ticket.assignee.name}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "success" : "default"}
              className="text-sm px-3 py-1"
            >
              {ticket.status.replace("_", " ")}
            </Badge>
            {canAct && (
              <div className={cn(
                "flex items-center text-sm font-medium px-3 py-1 rounded-full",
                ticket.resolutionSLA.state === "BREACHED" ? "bg-red-50 text-red-700" :
                ticket.resolutionSLA.state === "AT_RISK" ? "bg-orange-50 text-orange-700" :
                "bg-slate-100 text-slate-600"
              )}>
                <Clock className="w-4 h-4 mr-1.5" />
                {ticket.resolutionSLA.state === "BREACHED"
                  ? "SLA Breached"
                  : `SLA: ${ticket.resolutionSLA.remainingBusinessMinutes}m remaining`}
                {ticket.resolutionSLA.state === "AT_RISK" && <span className="ml-1">(At Risk)</span>}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-slate-700 whitespace-pre-wrap">
          {ticket.description}
        </div>

        {/* Agent Action Bar */}
        {isAgent && canAct && (
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            {/* Status change buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-slate-500 mr-1">Change status:</span>
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  isLoading={changingStatus || resolvingTicket}
                  onClick={() => handleChangeStatus(s)}
                  className={s === "RESOLVED" ? "border-emerald-500 text-emerald-700 hover:bg-emerald-50" : ""}
                >
                  {s === "RESOLVED" && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  {s === "IN_PROGRESS" && <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>

            {/* Assign dropdown */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-slate-500 mr-1">Assign to:</span>
              {agents.length > 0 && (
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Me ({currentUser?.email ?? "you"})</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <Button
                variant="outline"
                size="sm"
                isLoading={assigningTicket}
                onClick={handleAssign}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                {selectedAssignee ? "Assign" : "Assign to Me"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Comments Thread */}
      <div className="space-y-6 mt-8">
        <h3 className="text-lg font-semibold text-slate-900">Activity Log</h3>

        <div className="space-y-4">
          {ticket.comments.map((comment: Comment) => {
            const isAgentComment = comment.author.role === "AGENT";
            return (
              <div key={comment.id} className={cn("flex w-full", isAgentComment ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-4",
                  isAgentComment
                    ? "bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-tl-sm"
                    : "bg-white border border-slate-200 text-slate-900 rounded-tr-sm shadow-sm"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {comment.author.name}
                      {isAgentComment && (
                        <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px]">AGENT</Badge>
                      )}
                    </span>
                    <span className="text-xs opacity-60">• {formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Box */}
        <form onSubmit={handleAddComment} className="mt-6 relative">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Type your reply here..."
            className="w-full min-h-[120px] rounded-xl border border-slate-200 p-4 pb-14 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm resize-none bg-white transition-shadow"
          />
          <div className="absolute bottom-3 right-3">
            <Button type="submit" isLoading={addingComment} disabled={!commentText.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Send Reply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
