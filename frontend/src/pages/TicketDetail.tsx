import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "urql";
import toast from "react-hot-toast";
import { ArrowLeft, Clock, Send, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { formatDate, cn } from "../lib/utils";

const TICKET_QUERY = `
  query GetTicket($id: ID!) {
    ticket(id: $id) {
      id
      title
      description
      status
      priority
      createdAt
      reporter { name id role }
      assignee { name id }
      resolutionSLA { state targetDate remainingBusinessMinutes }
      comments {
        id
        content
        createdAt
        author { name role id }
      }
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  mutation AddComment($ticketId: ID!, $content: String!) {
    addComment(ticketId: $ticketId, content: $content) {
      id
    }
  }
`;

const RESOLVE_TICKET_MUTATION = `
  mutation ResolveTicket($ticketId: ID!) {
    resolveTicket(ticketId: $ticketId) {
      id
      status
    }
  }
`;

export function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");
  
  const [{ data, fetching }, executeQuery] = useQuery({
    query: TICKET_QUERY,
    variables: { id },
  });

  const [{ fetching: addingComment }, addComment] = useMutation(ADD_COMMENT_MUTATION);
  const [{ fetching: resolvingTicket }, resolveTicket] = useMutation(RESOLVE_TICKET_MUTATION);

  if (fetching && !data) {
    return <div className="p-8 text-center text-slate-500">Loading ticket details...</div>;
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return <div className="p-8 text-center text-red-500">Ticket not found</div>;
  }

  // A real app would get current user ID/Role from context.
  // For this demo, we can just infer agent status based on UI needs or assume they are an Agent if they have the token.
  // We'll show the controls regardless, and rely on the backend to enforce FORBIDDEN.
  
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const res = await addComment({ ticketId: ticket.id, content: commentText });
    if (res.error) {
      toast.error(res.error.message);
    } else {
      setCommentText("");
      executeQuery({ requestPolicy: 'network-only' });
    }
  };

  const handleResolve = async () => {
    const res = await resolveTicket({ ticketId: ticket.id });
    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success("Ticket resolved!");
      executeQuery({ requestPolicy: 'network-only' });
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
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              Reported by <span className="font-medium text-slate-900">{ticket.reporter.name}</span>
              <span>•</span>
              {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={ticket.status === "RESOLVED" ? "success" : "default"} className="text-sm px-3 py-1">
              {ticket.status}
            </Badge>
            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <div className="flex items-center text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                <Clock className="w-4 h-4 mr-1.5" />
                SLA: {ticket.resolutionSLA.remainingBusinessMinutes}m remaining
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-slate-700 whitespace-pre-wrap">
          {ticket.description}
        </div>

        {/* Agent Action Bar */}
        {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
            <Button onClick={handleResolve} isLoading={resolvingTicket} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Resolve Ticket
            </Button>
            <Button variant="outline">
              <UserPlus className="w-4 h-4 mr-2" />
              Assign to Me
            </Button>
          </div>
        )}
      </Card>

      {/* Comments Thread */}
      <div className="space-y-6 mt-8">
        <h3 className="text-lg font-semibold text-slate-900">Activity Log</h3>
        
        <div className="space-y-4">
          {ticket.comments.map((comment: any) => {
            const isAgent = comment.author.role === "AGENT";
            return (
              <div key={comment.id} className={cn("flex w-full", isAgent ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-5 py-4",
                  isAgent ? "bg-indigo-50 border border-indigo-100 text-indigo-950 rounded-tl-sm" : "bg-white border border-slate-200 text-slate-900 rounded-tr-sm shadow-sm"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {comment.author.name} {isAgent && <Badge variant="default" className="ml-1 px-1.5 py-0 text-[10px]">AGENT</Badge>}
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
