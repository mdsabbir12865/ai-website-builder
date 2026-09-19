import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { readApiResponse } from "../lib/githubExport";
import {
  deploymentPhaseLabel,
  humanizeVercelError,
  isTerminalDeploymentState,
  sanitizeVercelProjectName,
} from "../lib/vercelDeploy";
import "./VercelDeploy.css";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function VercelDeploy({
  projectId,
  projectName,
  linkedVercelProjectId,
  linkedVercelProjectName,
  lastDeploymentUrl,
  githubRepository,
  githubBranch,
  onProjectMetaChange,
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    linkedVercelProjectId || ""
  );
  const [createName, setCreateName] = useState(
    sanitizeVercelProjectName(linkedVercelProjectName || projectName || "website")
  );
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("vercel_error") || "";
  });
  const [success, setSuccess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("vercel_connected") === "1"
      ? "Vercel connected successfully."
      : "";
  });
  const [phase, setPhase] = useState("");
  const [readyState, setReadyState] = useState("");
  const [liveUrl, setLiveUrl] = useState(lastDeploymentUrl || "");
  const [deploymentId, setDeploymentId] = useState("");
  const requestIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const pollStartedRef = useRef(0);
  const deployingRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

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
          humanizeVercelError(
            data.code,
            data.error || `Vercel request failed (${response.status}).`
          )
        );
        err.code = data.code;
        throw err;
      }

      return data;
    },
    [getToken]
  );

  const loadProjects = useCallback(async () => {
    const data = await request("/api/vercel/projects");
    setProjects(data.projects || []);
  }, [request]);

  const loadStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const data = await request("/api/vercel/status");
      if (requestId !== requestIdRef.current) return;

      if (!data.connected || !data.connection) {
        setConnection(null);
        setProjects([]);
        return;
      }

      setConnection(data.connection);

      if (data.connection.tokenValid === false) {
        setError(
          humanizeVercelError(
            data.code || "TOKEN_INVALID",
            data.error
          )
        );
      }

      await loadProjects();
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [loadProjects, request]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("vercel_error") || params.get("vercel_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (linkedVercelProjectId) {
      setSelectedProjectId(linkedVercelProjectId);
    }
  }, [linkedVercelProjectId]);

  useEffect(() => {
    if (lastDeploymentUrl) setLiveUrl(lastDeploymentUrl);
  }, [lastDeploymentUrl]);

  useEffect(() => () => clearPoll(), [clearPoll]);

  async function connect() {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      sessionStorage.setItem("vercel_export_open", "1");

      const data = await request("/api/vercel/connect", {
        method: "POST",
        body: JSON.stringify({ returnTo: window.location.pathname }),
      });

      if (!data.authorizationUrl) {
        throw new Error("Vercel authorization URL is missing.");
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
      await request("/api/vercel/disconnect", { method: "POST" });
      setConnection(null);
      setProjects([]);
      setSelectedProjectId("");
      setPhase("");
      setReadyState("");
      setSuccess("Vercel disconnected. You can reconnect anytime.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();
    if (!projectId) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const data = await request("/api/vercel/create-project", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name: createName.trim(),
        }),
      });

      const created = data.project;
      setProjects((items) => [created, ...items]);
      setSelectedProjectId(created.id);
      setShowCreate(false);
      setSuccess("Vercel project created. You can deploy now.");
      onProjectMetaChange?.({
        vercel_project_id: created.id,
        vercel_project_name: created.name,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function schedulePoll(nextDeploymentId) {
    clearPoll();
    pollTimerRef.current = setTimeout(() => {
      pollStatus(nextDeploymentId);
    }, POLL_INTERVAL_MS);
  }

  async function pollStatus(activeDeploymentId) {
    if (!projectId || !activeDeploymentId) return;

    if (Date.now() - pollStartedRef.current > POLL_TIMEOUT_MS) {
      clearPoll();
      deployingRef.current = false;
      setBusy(false);
      setPhase("failed");
      setError(humanizeVercelError("DEPLOYMENT_TIMEOUT"));
      return;
    }

    try {
      const data = await request(
        `/api/vercel/deployment-status?projectId=${encodeURIComponent(
          projectId
        )}&deploymentId=${encodeURIComponent(activeDeploymentId)}`
      );

      const deployment = data.deployment;
      setReadyState(deployment.readyState || "");
      setPhase(deployment.phase || "");

      if (deployment.url) {
        setLiveUrl(deployment.url);
        onProjectMetaChange?.({
          last_deployment_url: deployment.url,
          last_deployment_id: deployment.id,
        });
      }

      if (isTerminalDeploymentState(deployment.readyState)) {
        clearPoll();
        deployingRef.current = false;
        setBusy(false);

        if (deployment.readyState === "READY") {
          setSuccess("Deployment successful. Your website is live.");
          setError("");
        } else if (deployment.readyState === "CANCELED") {
          setError("Deployment was canceled.");
        } else {
          setError(
            deployment.readyStateReason ||
              humanizeVercelError("DEPLOYMENT_FAILED")
          );
        }
        return;
      }

      schedulePoll(activeDeploymentId);
    } catch (err) {
      clearPoll();
      deployingRef.current = false;
      setBusy(false);
      setPhase("failed");
      setError(err.message);
    }
  }

  async function deploy() {
    if (!projectId || deployingRef.current) return;

    deployingRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    setPhase("initializing");
    setReadyState("QUEUED");
    clearPoll();

    try {
      const payload = {
        projectId,
        vercelProjectId: selectedProjectId || undefined,
        vercelProjectName: createName.trim() || undefined,
      };

      if (githubRepository) payload.githubRepository = githubRepository;
      if (githubBranch) payload.githubBranch = githubBranch;

      const data = await request("/api/vercel/deploy", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const deployment = data.deployment;
      setDeploymentId(deployment.id || "");
      setSelectedProjectId(deployment.vercelProjectId || selectedProjectId);
      setReadyState(deployment.readyState || "QUEUED");
      setPhase(deployment.phase || "deploying");

      if (deployment.url) setLiveUrl(deployment.url);

      onProjectMetaChange?.({
        vercel_project_id: deployment.vercelProjectId,
        vercel_project_name: deployment.vercelProjectName,
        last_deployment_id: deployment.id,
        last_deployment_url: deployment.url || null,
      });

      if (isTerminalDeploymentState(deployment.readyState)) {
        deployingRef.current = false;
        setBusy(false);
        if (deployment.readyState === "READY") {
          setSuccess("Deployment successful. Your website is live.");
        } else {
          setError(humanizeVercelError("DEPLOYMENT_FAILED"));
        }
        return;
      }

      pollStartedRef.current = Date.now();
      schedulePoll(deployment.id);
    } catch (err) {
      deployingRef.current = false;
      setBusy(false);
      setPhase("failed");
      setError(err.message);
    }
  }

  const canOneClick =
    Boolean(connection?.tokenValid !== false && connection) &&
    Boolean(selectedProjectId || linkedVercelProjectId);

  if (loading) {
    return (
      <div className="vercel-deploy" aria-busy="true">
        <p className="vercel-muted">Checking Vercel connection…</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="vercel-deploy vercel-deploy-only">
        <button
          type="button"
          className="vercel-connect-button"
          onClick={connect}
          disabled={busy}
        >
          <span className="vercel-mark" aria-hidden="true">
            ▲
          </span>
          <span>{busy ? "Connecting…" : "Connect Vercel"}</span>
        </button>
        {success ? <div className="vercel-success" role="status">{success}</div> : null}
        {error ? <div className="vercel-error" role="alert">{error}</div> : null}
      </div>
    );
  }

  const needsReconnect = connection.tokenValid === false;

  return (
    <div className="vercel-deploy">
      <div className="vercel-connected" role="status">
        <span className="vercel-connected-label">
          {connection.avatar ? (
            <img
              className="vercel-avatar"
              src={connection.avatar}
              alt=""
              width="22"
              height="22"
            />
          ) : (
            <span className="vercel-mark" aria-hidden="true">
              ▲
            </span>
          )}
          <span>
            ✓ Vercel Connected
            {connection.username ? ` — ${connection.username}` : ""}
          </span>
        </span>
        <button
          type="button"
          className="vercel-disconnect-button"
          onClick={disconnect}
          disabled={busy}
        >
          Disconnect
        </button>
      </div>

      {needsReconnect ? (
        <div className="vercel-card vercel-reconnect-card">
          <p className="vercel-muted">
            Your Vercel connection needs to be refreshed before you can deploy.
          </p>
          <button
            type="button"
            className="vercel-primary-button"
            onClick={connect}
            disabled={busy}
          >
            Reconnect Vercel
          </button>
        </div>
      ) : (
        <>
          <div className="vercel-card">
            <div className="vercel-card-header">
              <div className="vercel-card-title">Vercel Project</div>
              <button
                type="button"
                className="vercel-ghost-button"
                onClick={() =>
                  loadProjects().catch((err) => setError(err.message))
                }
                disabled={busy}
              >
                Refresh
              </button>
            </div>

            {selectedProjectId || linkedVercelProjectId ? (
              <p className="vercel-linked" role="status">
                Linked:{" "}
                <strong>
                  {projects.find((p) => p.id === selectedProjectId)?.name ||
                    linkedVercelProjectName ||
                    selectedProjectId}
                </strong>
              </p>
            ) : (
              <p className="vercel-muted">
                Select an existing project or create a new one for this website.
              </p>
            )}

            {projects.length ? (
              <div className="vercel-project-list" role="listbox" aria-label="Vercel projects">
                {projects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    role="option"
                    aria-selected={selectedProjectId === project.id}
                    className={`vercel-project ${
                      selectedProjectId === project.id
                        ? "vercel-project-selected"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowCreate(false);
                      onProjectMetaChange?.({
                        vercel_project_id: project.id,
                        vercel_project_name: project.name,
                      });
                    }}
                    disabled={busy}
                  >
                    <span className="vercel-project-info">
                      <strong>{project.name}</strong>
                      <span className="vercel-project-meta">
                        {project.framework || "Static"} · {project.id}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="vercel-muted">No Vercel projects found yet.</p>
            )}

            <button
              type="button"
              className="vercel-secondary-button"
              onClick={() => setShowCreate((value) => !value)}
              disabled={busy}
            >
              {showCreate ? "Hide create form" : "Create new Vercel project"}
            </button>

            {showCreate ? (
              <form onSubmit={createProject} className="vercel-create-form">
                <label className="vercel-field-label" htmlFor="vercel-project-name">
                  Project name
                </label>
                <input
                  id="vercel-project-name"
                  className="vercel-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={busy}
                  maxLength={100}
                  required
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="vercel-primary-button"
                  disabled={busy || !createName.trim()}
                >
                  {busy ? "Creating…" : "Create Project"}
                </button>
              </form>
            ) : null}
          </div>

          <div className="vercel-card vercel-deploy-card">
            <div className="vercel-card-title">Deploy Website</div>
            <p className="vercel-muted">
              Deploys static <code>index.html</code>, <code>style.css</code>, and{" "}
              <code>script.js</code>
              {githubRepository
                ? ` · linked GitHub ${githubRepository}${
                    githubBranch ? `@${githubBranch}` : ""
                  }`
                : ""}
              .
            </p>

            {(phase || readyState) && busy ? (
              <div className="vercel-progress" role="status" aria-live="polite">
                <div className="vercel-progress-bar" aria-hidden="true">
                  <span className="vercel-progress-pulse" />
                </div>
                <p className="vercel-progress-label">
                  {deploymentPhaseLabel(phase, readyState)}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="vercel-primary-button vercel-deploy-button"
              onClick={deploy}
              disabled={busy || (!canOneClick && !showCreate && !selectedProjectId && projects.length > 0)}
            >
              {busy
                ? deploymentPhaseLabel(phase, readyState)
                : canOneClick
                  ? liveUrl
                    ? "Deploy Again"
                    : "Deploy to Vercel"
                  : selectedProjectId || !projects.length
                    ? "Deploy to Vercel"
                    : "Select a project to deploy"}
            </button>

            {!selectedProjectId && !projects.length ? (
              <p className="vercel-hint">
                No project selected — deploy will create one automatically from
                your website name.
              </p>
            ) : null}
          </div>
        </>
      )}

      {liveUrl && readyState === "READY" ? (
        <div className="vercel-success vercel-live" role="status">
          <div className="vercel-live-title">✓ Your website is live</div>
          <a
            className="vercel-live-link"
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {liveUrl.replace(/^https?:\/\//, "")}
          </a>
          <div className="vercel-live-actions">
            <a
              className="vercel-primary-button vercel-open-link"
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Website
            </a>
            <button
              type="button"
              className="vercel-secondary-button"
              onClick={deploy}
              disabled={busy}
            >
              Deploy Again
            </button>
          </div>
        </div>
      ) : null}

      {success && !(liveUrl && readyState === "READY") ? (
        <div className="vercel-success" role="status">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="vercel-error" role="alert">
          <p>{error}</p>
          <div className="vercel-error-actions">
            {/reconnect|expired|revoked|connection/i.test(error) ? (
              <button
                type="button"
                className="vercel-secondary-button"
                onClick={connect}
                disabled={busy}
              >
                Reconnect Vercel
              </button>
            ) : (
              <button
                type="button"
                className="vercel-secondary-button"
                onClick={deploy}
                disabled={busy || needsReconnect}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : null}

      {deploymentId ? (
        <p className="vercel-meta" aria-hidden="true">
          Deployment {deploymentId}
        </p>
      ) : null}
    </div>
  );
}

export default VercelDeploy;
