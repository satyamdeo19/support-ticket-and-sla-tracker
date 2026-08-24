import { useState } from "react";
import { useMutation } from "urql";
import toast from "react-hot-toast";
import { setAuthToken } from "../lib/graphql";
import { Button } from "../components/ui/Button";

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [{ fetching }, login] = useMutation(LOGIN_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    
    if (result.error) {
      toast.error("Invalid credentials.");
      return;
    }

    setAuthToken(result.data.login.token);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-6">Login to SLA Tracker</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="agent@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" isLoading={fetching}>
            Sign In
          </Button>
          <div className="text-center text-sm text-slate-500 pt-2">
            Test accounts: agent@example.com / reporter@example.com (password123)
          </div>
        </form>
      </div>
    </div>
  );
}
