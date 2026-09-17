import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  buildGitHubExportFiles,
  readApiResponse,
} from "../lib/githubExport";
import "./GitHubConnect.css";

function GitHubConnect({ projectName, htmlCode, cssCode, jsCode }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepository, setSelectedRepository] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("github_error") || "";
  });
  const [success, setSuccess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("github_connected") === "1"
      ? "GitHub connected with repository access."
      : "";
  });
  const [repoName, setRepoName] = useState("");
  const [repoDescription, setRepoDescription] = useState("");
  const [repoPrivate, setRepoPrivate] = useState(false);
  const [commitMessage, setCommitMessage] = useState(
    "Export website from AI Website Builder"
  );
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const requestIdRef = useRef(0);

  const getToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      throw new Error("Please log in first.");
    }
    return data.session.access_token;
  }, []);

  const request = useCallback(
    async (path, options = {}) => {
      const accessToken = await getToken();
      const response = await fetch(path, {
        ...options,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });

      const data = await readApiResponse(response);

      if (!response.ok || data.success === false) {
        const err = new Error(
          data.error || `GitHub request failed (${response.status}).`
        );
        err.code = data.code;
        throw err;
      }

      return data;
    },
    [getToken]
  );

  const loadRepositories = useCallback(async () => {
    const data = await request("/api/github/repos");
    setRepositories(data.repositories || []);
  }, [request]);

  const loadStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const data = await request("/api/github/status");
      if (requestId !== requestIdRef.current) return;

      if (!data.connected || !data.connection) {
        setConnection(null);
        setRepositories([]);
        setSelectedRepository(null);
        setBranches([]);
        setBranch("");
        return;
      }

      setConnection(data.connection);

      if (data.connection.hasRepoScope === false) {
        setError(
          "GitHub is connected but repository access was not granted. Disconnect, revoke the app in GitHub Settings → Applications → Authorized OAuth Apps, then reconnect and approve repository access."
        );
      }

      await loadRepositories();
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [loadRepositories, request]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_error") || params.get("github_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    loadStatus();
  }, [loadStatus]);

  async function connect() {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      sessionStorage.setItem("github_export_open", "1");

      const data = await request("/api/github/connect", {
        method: "POST",
        body: JSON.stringify({ returnTo: window.location.pathname }),
      });

      if (!data.authorizationUrl) {
        throw new Error("GitHub authorization URL is missing.");
      }

      window.location.assign(data.authorizationUrl);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await request("/api/github/disconnect", { method: "POST" });
      setConnection(null);
      setRepositories([]);
      setSelectedRepository(null);
      setBranches([]);
      setBranch("");
      setRepositoryUrl("");
      setSuccess(
        "GitHub disconnected. You can reconnect to grant repository access again."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function selectRepository(repo) {
    setBusy(true);
    setError("");
    setSuccess("");
    setRepositoryUrl("");

    try {
      const data = await request(
        `/api/github/branches?repository=${encodeURIComponent(repo.full_name)}`
      );
      setSelectedRepository(repo);
      setBranches(data.branches || []);
      setBranch(data.defaultBranch || data.branches?.[0]?.name || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createRepository(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const data = await request("/api/github/create-repo", {
        method: "POST",
        body: JSON.stringify({
          name: repoName.trim(),
          description: repoDescription.trim(),
          private: repoPrivate,
        }),
      });

      setRepositories((items) => [data.repository, ...items]);
      setRepoName("");
      setRepoDescription("");
      setRepoPrivate(false);
      setSuccess("Repository created. Select a branch and push your website.");
      await selectRepository(data.repository);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function push() {
    if (!selectedRepository || !branch) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const files = buildGitHubExportFiles(
        projectName,
        htmlCode,
        cssCode,
        jsCode
      );

      const data = await request("/api/github/push", {
        method: "POST",
        body: JSON.stringify({
          repository: selectedRepository.full_name,
          branch,
          message: commitMessage.trim(),
          files,
        }),
      });

      setRepositoryUrl(data.repositoryUrl || "");
      setSuccess("Website files were committed to GitHub.");

      if (data.repositoryUrl) {
        window.open(data.repositoryUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="github-connect">
        <p className="github-muted">Checking GitHub connection…</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="github-connect github-connect-only">
        <button
          type="button"
          className="github-connect-button"
          onClick={connect}
          disabled={busy}
        >
          <span className="github-symbol">⌥</span>
          <span>{busy ? "Connecting…" : "Connect GitHub"}</span>
        </button>
        {success && <div className="github-success">{success}</div>}
        {error && <div className="github-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="github-connect">
      <div className="github-connected" role="status">
        <span className="github-connected-label">
          {connection.avatar ? (
            <img
              className="github-avatar"
              src={connection.avatar}
              alt=""
              width="22"
              height="22"
            />
          ) : null}
          <span>
            ✓ GitHub Connected
            {connection.login ? ` — ${connection.login}` : ""}
          </span>
        </span>
        <button
          type="button"
          className="github-disconnect-button"
          onClick={disconnect}
          disabled={busy}
        >
          Disconnect
        </button>
      </div>

      <form onSubmit={createRepository} className="github-card">
        <div className="github-card-title">Create New Repository</div>
        <input
          className="github-input"
          placeholder="Repository name"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          disabled={busy}
          maxLength={100}
          required
        />
        <textarea
          className="github-textarea"
          placeholder="Description (optional)"
          value={repoDescription}
          onChange={(e) => setRepoDescription(e.target.value)}
          disabled={busy}
          rows={2}
          maxLength={350}
        />
        <label className="github-checkbox">
          <input
            type="checkbox"
            checked={repoPrivate}
            onChange={(e) => setRepoPrivate(e.target.checked)}
            disabled={busy}
          />
          Private repository
        </label>
        <button
          className="github-create-button"
          disabled={busy || !repoName.trim()}
        >
          {busy ? "Working…" : "Create Repository"}
        </button>
      </form>

      <div className="github-card">
        <div className="github-repo-header">
          <div className="github-card-title">Select Existing Repository</div>
          <button
            type="button"
            className="github-refresh-button"
            onClick={() =>
              loadRepositories().catch((err) => setError(err.message))
            }
            disabled={busy}
          >
            Refresh
          </button>
        </div>

        {repositories.length ? (
          <div className="github-repo-list">
            {repositories.map((repo) => (
              <button
                type="button"
                key={repo.id}
                className={`github-repo ${
                  selectedRepository?.id === repo.id
                    ? "github-repo-selected"
                    : ""
                }`}
                onClick={() => selectRepository(repo)}
                disabled={busy}
              >
                <span className="github-repo-info">
                  <strong>{repo.full_name}</strong>
                  <span className="github-repo-meta">
                    {repo.private ? "Private" : "Public"} ·{" "}
                    {repo.default_branch || "main"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="github-muted">No repositories found.</p>
        )}
      </div>

      {selectedRepository && (
        <div className="github-card">
          <div className="github-card-title">Push Builder Files</div>
          <p className="github-muted">
            Exports <code>index.html</code>, <code>style.css</code>, and{" "}
            <code>script.js</code> to{" "}
            <strong>{selectedRepository.full_name}</strong>.
          </p>
          <label className="github-field-label" htmlFor="github-branch">
            Branch
          </label>
          <select
            id="github-branch"
            className="github-input"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={busy || !branches.length}
          >
            {branches.length === 0 ? (
              <option value="">No branches available</option>
            ) : (
              branches.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                  {item.default ? " (default)" : ""}
                </option>
              ))
            )}
          </select>
          <label className="github-field-label" htmlFor="github-commit">
            Commit message
          </label>
          <input
            id="github-commit"
            className="github-input"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={busy}
            maxLength={250}
          />
          <button
            type="button"
            className="github-create-button"
            onClick={push}
            disabled={busy || !branch || !commitMessage.trim()}
          >
            {busy ? "Pushing…" : "Push to GitHub"}
          </button>
        </div>
      )}

      {success && (
        <div className="github-success">
          {success}
          {repositoryUrl ? (
            <>
              {" "}
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="github-view-link"
              >
                Open repository
              </a>
            </>
          ) : null}
        </div>
      )}
      {error && <div className="github-error">{error}</div>}
    </div>
  );
}

export default GitHubConnect;
