import { useState } from "react";
import { useMutation } from "urql";
import toast from "react-hot-toast";
import { setAuthToken } from "../lib/graphql";
import { Button } from "../components/ui/Button";
import type { UserRole } from "../lib/types";

const REGISTER_MUTATION = `
  mutation Register($name: String!, $email: String!, $password: String!, $role: UserRole) {
    register(name: $name, email: $email, password: $password, role: $role) {
      token
      user { id name role }
    }
  }
`;

export function Register({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("REPORTER");
  const [{ fetching }, register] = useMutation(REGISTER_MUTATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields are required.");
      return;
    }
    const result = await register({ name, email, password, role });
    if (result.error) {
      toast.error(result.error.graphQLErrors[0]?.message ?? "Registration failed.");
      return;
    }
    setAuthToken(result.data.register.token);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Create Account</h1>
        <p className="text-center text-sm text-slate-500 mb-6">Join the SLA Tracker team</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
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
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="REPORTER">Reporter (submit tickets)</option>
              <option value="AGENT">Agent (handle tickets)</option>
            </select>
          </div>
          <Button type="submit" className="w-full" isLoading={fetching}>
            Create Account
          </Button>
          <div className="text-center text-sm text-slate-500 pt-2">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
