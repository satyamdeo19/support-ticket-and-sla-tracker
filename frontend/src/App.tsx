import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Dashboard } from "./pages/Dashboard";
import { TicketDetail } from "./pages/TicketDetail";
import { Login } from "./pages/Login";
import { LogOut, TicketIcon } from "lucide-react";
import { clearAuthToken, getAuthToken } from "./lib/graphql";

function Layout({ children }: { children: React.ReactNode }) {
  const handleLogout = () => {
    clearAuthToken();
    window.location.reload(); // Hard reload to clear Apollo/Urql cache state
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 text-white p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
                <TicketIcon className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">SLA Tracker</span>
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-900 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const token = getAuthToken();

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Login />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </Layout>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  );
}
