import {
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

function GitHubConnect() {
  const [loading, setLoading] =
    useState(false);

  const [connected, setConnected] =
    useState(false);

  const [connection, setConnection] =
    useState(null);

  const [error, setError] =
    useState("");

  async function getAccessToken() {
    const {
      data,
      error,
    } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return (
      data?.session?.access_token ||
      null
    );
  }

  async function loadStatus() {
    try {
      const token =
        await getAccessToken();

      if (!token) {
        return;
      }
const response =
  await fetch(
    "/api/github/connect",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        returnTo:
          window.location.pathname +
          window.location.search,
      }),
    }
  );
      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to check GitHub."
        );
      }

      setConnected(
        Boolean(data.connected)
      );

      setConnection(
        data.connection || null
      );
    } catch (error) {
      console.error(
        "GitHub status error:",
        error
      );
    }
  }

  useEffect(() => {
    loadStatus();

    const params =
      new URLSearchParams(
        window.location.search
      );

    const githubConnected =
      params.get(
        "github_connected"
      );

    const githubError =
      params.get(
        "github_error"
      );

    if (githubConnected === "1") {
      setConnected(true);

      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );

      loadStatus();
    }

    if (githubError) {
      setError(
        githubError
      );

      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError("");

    try {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Please log in first."
        );
      }

      const response =
        await fetch(
          "/api/github/connect",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to connect GitHub."
        );
      }

      window.location.href =
        data.authorizationUrl;
    } catch (error) {
      console.error(
        "GitHub connect error:",
        error
      );

      setError(
        error?.message ||
          "GitHub connection failed."
      );

      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError("");

    try {
      const token =
        await getAccessToken();

      const response =
        await fetch(
          "/api/github/disconnect",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Disconnect failed."
        );
      }

      setConnected(false);
      setConnection(null);
    } catch (error) {
      console.error(
        "GitHub disconnect error:",
        error
      );

      setError(
        error?.message ||
          "Disconnect failed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button
          type="button"
          onClick={
            handleDisconnect
          }
          disabled={loading}
        >
          ✓ GitHub Connected
          {connection?.login
            ? ` — ${connection.login}`
            : ""}
        </button>

        {error && (
          <small
            style={{
              color: "#dc2626",
            }}
          >
            {error}
          </small>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <button
        type="button"
        onClick={
          handleConnect
        }
        disabled={loading}
      >
        ◇{" "}
        {loading
          ? "Connecting..."
          : "Connect GitHub"}
      </button>

      {error && (
        <small
          style={{
            color: "#dc2626",
          }}
        >
          {error}
        </small>
      )}
    </div>
  );
}

export default GitHubConnect;