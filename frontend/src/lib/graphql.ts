import { Client, cacheExchange, fetchExchange } from "urql";
import type { UserRole } from "./types";

export const getAuthToken = () => localStorage.getItem("token") ?? "";

export const setAuthToken = (token: string) => {
  localStorage.setItem("token", token);
};

export const clearAuthToken = () => {
  localStorage.removeItem("token");
};

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/** Safely decode JWT payload without verification (server validates on each request). */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

export const client = new Client({
  url: "http://localhost:4000/graphql",
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    const token = getAuthToken();
    return {
      headers: { authorization: token ? `Bearer ${token}` : "" },
    };
  },
});
