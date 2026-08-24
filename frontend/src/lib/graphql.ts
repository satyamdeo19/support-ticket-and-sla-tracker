import { Client, cacheExchange, fetchExchange } from "urql";

export const getAuthToken = () => localStorage.getItem("token") || "";

export const setAuthToken = (token: string) => {
  localStorage.setItem("token", token);
};

export const clearAuthToken = () => {
  localStorage.removeItem("token");
};

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
