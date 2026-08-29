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

  const [repositories, setRepositories] =
    useState([]);

  const [reposLoading, setReposLoading] =
    useState(false);

  const [error, setError] =
    useState("");
const [repoName, setRepoName] = useState("");
const [repoDescription, setRepoDescription] = useState("");
const [repoPrivate, setRepoPrivate] = useState(false);
const [creatingRepo, setCreatingRepo] = useState(false);
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
          "/api/github/status",
          {
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
            "Unable to check GitHub."
        );
      }

      setConnected(
        Boolean(data.connected)
      );

      setConnection(
        data.connection || null
      );

      if (data.connected) {
        await loadRepositories();
      }
    } catch (error) {
      console.error(
        "GitHub status error:",
        error
      );
    }
  }

  async function loadRepositories() {
    setReposLoading(true);
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
          "/api/github/repos",
          {
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
            "Unable to load repositories."
        );
      }

      setRepositories(
        data.repositories || []
      );
    } catch (error) {
      console.error(
        "GitHub repositories error:",
        error
      );

      setError(
        error?.message ||
          "Unable to load repositories."
      );
    } finally {
      setReposLoading(false);
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
            body: JSON.stringify({
              returnTo:
                window.location.pathname,
            }),
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
      setRepositories([]);
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
          gap: "12px",
          width: "100%",
          maxWidth: "600px",
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

        <div
          style={{
            border:
              "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "16px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              marginBottom: "12px",
            }}
          >
            <strong>
              GitHub Repositories
            </strong>

            <button
              type="button"
              onClick={
                loadRepositories
              }
              disabled={reposLoading}
            >
              {reposLoading
                ? "Loading..."
                : "Refresh"}
            </button>
          </div>

          {reposLoading &&
            repositories.length === 0 && (
              <p>
                Loading repositories...
              </p>
            )}

          {!reposLoading &&
            repositories.length === 0 &&
            !error && (
              <p>
                No repositories found.
              </p>
            )}

          {repositories.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "8px",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {repositories.map(
                (repo) => (
                  <div
                    key={repo.id}
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                      padding:
                        "12px",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius:
                        "8px",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <strong>
                        {repo.name}
                      </strong>

                      <div
                        style={{
                          fontSize:
                            "12px",
                          color:
                            "#6b7280",
                          marginTop:
                            "4px",
                        }}
                      >
                        {repo.private
                          ? "🔒 Private"
                          : "🌐 Public"}

                        {" · "}

                        {repo.default_branch ||
                          "main"}
                      </div>

                      {repo.description && (
                        <div
                          style={{
                            fontSize:
                              "13px",
                            color:
                              "#6b7280",
                            marginTop:
                              "4px",
                          }}
                        >
                          {
                            repo.description
                          }
                        </div>
                      )}
                    </div>

                    <a
                      href={
                        repo.html_url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  </div>
                )
              )}
            </div>
          )}
        </div>

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