import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./GitHubConnect.css";

function GitHubConnect() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [error, setError] = useState("");

  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [repoPrivate, setRepoPrivate] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);

  async function getAccessToken() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data?.session?.access_token || null;
  }

  async function loadRepositories() {
    setReposLoading(true);
    setError("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Please log in first.");
      }

      const response = await fetch("/api/github/repos", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load repositories."
        );
      }

      setRepositories(data.repositories || []);
    } catch (error) {
      console.error("GitHub repositories error:", error);

      setError(
        error?.message || "Unable to load repositories."
      );
    } finally {
      setReposLoading(false);
    }
  }

  async function loadStatus() {
    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/github/status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to check GitHub."
        );
      }

      const isConnected = Boolean(data.connected);

      setConnected(isConnected);
      setConnection(data.connection || null);

      if (isConnected) {
        await loadRepositories();
      }
    } catch (error) {
      console.error("GitHub status error:", error);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const githubConnected = params.get("github_connected");
    const githubError = params.get("github_error");

    if (githubError) {
      setError(githubError);
    }

    if (githubConnected === "1") {
      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }

    loadStatus();
  }, []);

  async function handleConnect() {
    setLoading(true);
    setError("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Please log in first.");
      }

      const response = await fetch("/api/github/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnTo: window.location.pathname,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to connect GitHub."
        );
      }

      if (!data.authorizationUrl) {
        throw new Error(
          "GitHub authorization URL is missing."
        );
      }

      window.location.href = data.authorizationUrl;
    } catch (error) {
      console.error("GitHub connect error:", error);

      setError(
        error?.message || "GitHub connection failed."
      );

      setLoading(false);
    }
  }

  async function handleCreateRepository(event) {
    event.preventDefault();

    const name = repoName.trim();

    if (!name) {
      setError("Repository name is required.");
      return;
    }

    setCreatingRepo(true);
    setError("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Please log in first.");
      }

      const response = await fetch(
        "/api/github/create-repo",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description: repoDescription.trim(),
            private: repoPrivate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create repository."
        );
      }

      setRepoName("");
      setRepoDescription("");
      setRepoPrivate(false);

      await loadRepositories();
    } catch (error) {
      console.error("Create repository error:", error);

      setError(
        error?.message ||
          "Unable to create repository."
      );
    } finally {
      setCreatingRepo(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Please log in first.");
      }

      const response = await fetch(
        "/api/github/disconnect",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Disconnect failed."
        );
      }

      setConnected(false);
      setConnection(null);
      setRepositories([]);
      setError("");
    } catch (error) {
      console.error("GitHub disconnect error:", error);

      setError(
        error?.message || "Disconnect failed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div className="github-connect">
        <button
          type="button"
          className="github-connected"
          onClick={handleDisconnect}
          disabled={loading}
        >
          <span>✓ GitHub Connected</span>

          {connection?.login && (
            <span className="github-login">
              — {connection.login}
            </span>
          )}
        </button>

        <form
          onSubmit={handleCreateRepository}
          className="github-card"
        >
          <div className="github-card-title">
            Create New Repository
          </div>

          <input
            type="text"
            className="github-input"
            placeholder="Repository name"
            value={repoName}
            onChange={(event) =>
              setRepoName(event.target.value)
            }
            disabled={creatingRepo}
          />

          <textarea
            className="github-textarea"
            placeholder="Description (optional)"
            value={repoDescription}
            onChange={(event) =>
              setRepoDescription(event.target.value)
            }
            disabled={creatingRepo}
            rows={3}
          />

          <label className="github-checkbox">
            <input
              type="checkbox"
              checked={repoPrivate}
              onChange={(event) =>
                setRepoPrivate(event.target.checked)
              }
              disabled={creatingRepo}
            />

            <span>Private repository</span>
          </label>

          <button
            type="submit"
            className="github-create-button"
            disabled={
              creatingRepo || !repoName.trim()
            }
          >
            {creatingRepo
              ? "Creating..."
              : "Create Repository"}
          </button>
        </form>

        <div className="github-card">
          <div className="github-repo-header">
            <div className="github-card-title">
              GitHub Repositories
            </div>

            <button
              type="button"
              className="github-refresh-button"
              onClick={loadRepositories}
              disabled={reposLoading}
            >
              {reposLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {reposLoading &&
            repositories.length === 0 && (
              <p className="github-muted">
                Loading repositories...
              </p>
            )}

          {!reposLoading &&
            repositories.length === 0 &&
            !error && (
              <p className="github-muted">
                No repositories found.
              </p>
            )}

          {repositories.length > 0 && (
            <div className="github-repo-list">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="github-repo"
                >
                  <div className="github-repo-info">
                    <strong>{repo.name}</strong>

                    <div className="github-repo-meta">
                      {repo.private
                        ? "Private"
                        : "Public"}

                      {" · "}

                      {repo.default_branch || "main"}
                    </div>

                    {repo.description && (
                      <div className="github-repo-description">
                        {repo.description}
                      </div>
                    )}
                  </div>

                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="github-view-link"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="github-error">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="github-connect github-connect-only">
      <button
        type="button"
        className="github-connect-button"
        onClick={handleConnect}
        disabled={loading}
      >
        <span className="github-symbol">◇</span>

        {loading
          ? "Connecting..."
          : "Connect GitHub"}
      </button>

      {error && (
        <div className="github-error">
          {error}
        </div>
      )}
    </div>
  );
}

export default GitHubConnect;