import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import JSZip from "jszip";
function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState("html");
const [activeMode, setActiveMode] = useState("code");

  const [device, setDevice] = useState("desktop");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
const [history, setHistory] = useState([]);
const [future, setFuture] = useState([]);
const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => {
    async function loadProject() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Project loading error:", error);
        setLoading(false);
        return;
      }

      setProject(data);
      setPrompt(data.prompt || "");

setHtmlCode(data.html_code || "");
setCssCode(data.css_code || "");
      setJsCode(data.js_code || "");

      setLoading(false);
    }

    loadProject();
  }, [projectId, navigate]);
function markChanged() {
  setSaved(false);

  setHistory((prev) => [
    ...prev.slice(-19),
    {
      html: htmlCode,
      css: cssCode,
      js: jsCode,
    },
  ]);
setFuture([]);
}

function saveHistory(type, value) {
  const currentState = {
    html: htmlCode,
    css: cssCode,
    js: jsCode,
  };

  const newState = {
    ...currentState,
    [type]: value,
  };

  const newHistory = history.slice(0, historyIndex + 1);

  newHistory.push(newState);

  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
}

function handleUndo() {
  if (historyIndex <= 0) return;

  const previous = history[historyIndex - 1];

  setHtmlCode(previous.html);
  setCssCode(previous.css);
  setJsCode(previous.js);

  setHistoryIndex(historyIndex - 1);
  setSaved(false);
}
async function handleDownloadZip() {
  try {
    const zip = new JSZip();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name || "My Website"}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${htmlCode}

<script src="script.js"></script>
</body>
</html>`;

    zip.file("index.html", html);
    zip.file("style.css", cssCode || "");
    zip.file("script.js", jsCode || "");

    const blob = await zip.generateAsync({
      type: "blob",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name || "website"}.zip`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("ZIP export error:", error);
    alert("ZIP export failed.");
  }
}
function handleExportCode() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name || "My Website"}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

${htmlCode}

<script src="script.js"></script>
</body>
</html>`;

  const code = `===== index.html =====

${html}


===== style.css =====

${cssCode}


===== script.js =====

${jsCode}
`;

  const blob = new Blob([code], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name || "website"}-code.txt`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
function handleRedo() {
  if (historyIndex >= history.length - 1) return;

  const next = history[historyIndex + 1];

  setHtmlCode(next.html);
  setCssCode(next.css);
  setJsCode(next.js);

  setHistoryIndex(historyIndex + 1);
  setSaved(false);
}

async function handleSave() {
  setSaving(true);

  const { error } = await supabase
    .from("projects")
    .update({
      prompt,
      html_code: htmlCode,
      css_code: cssCode,
      js_code: jsCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  setSaving(false);

  if (error) {
    console.error("Save error:", error);
    alert("Save failed.");
    return;
  }

  setSaved(true);
}
async function handleGenerate() {
  if (!prompt.trim()) {
    alert("Please describe what you want to build.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,

        currentCode: {
          html: htmlCode,
          css: cssCode,
          js: jsCode,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "AI generation failed."
      );
    }

    setHtmlCode(data.html || "");
    setCssCode(data.css || "");
    setJsCode(data.js || "");

    setSaved(false);
    setPreviewKey((prev) => prev + 1);

    // Generated code history-তে রাখা
    setHistory((prev) => [
      ...prev.slice(-19),
      {
        html: data.html || "",
        css: data.css || "",
        js: data.js || "",
      },
    ]);

    setHistoryIndex((prev) => prev + 1);

    // Generate হওয়ার পর preview দেখাবে
    setActiveMode("preview");

  } catch (error) {
    console.error("AI Generate Error:", error);

    alert(
      error.message ||
      "Something went wrong while generating the website."
    );
  } finally {
    setLoading(false);
  }
}

const previewDocument = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <style>
    html,
    body {
      margin: 0;
      min-height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }

    ${cssCode || ""}
  </style>
</head>

<body>
  ${htmlCode || ""}

  <script>
    ${jsCode || ""}
  <\/script>
</body>
</html>
`;

if (loading) {
  return (
    <div className="builder-loading">
      <div className="builder-loader-orb">✦</div>
      <h2>Preparing your workspace...</h2>
      <p>Loading project</p>
    </div>
  );
}

if (!project) {
  return (
    <div className="builder-error">
      <div className="error-icon">!</div>

      <h2>Project not found</h2>

      <p>
        This project may have been deleted or moved.
      </p>

      <button onClick={() => navigate("/dashboard")}>
        ← Back to Dashboard
      </button>
    </div>
  );
}

  return (
    <div
      className={`builder-page ${
        fullscreen ? "builder-fullscreen" : ""
      }`}
    >

      {/* TOP NAVBAR */}

      <header className="builder-topbar">

        <div className="builder-brand-area">

          <button
            className="builder-back"
            onClick={() => navigate("/dashboard")}
          >
            ←
          </button>

          <div className="builder-brand">
            <div className="builder-logo">✦</div>

            <div>
              <strong>WebAI</strong>
              <span>BUILDER</span>
            </div>
          </div>

          <div className="builder-divider"></div>

          <div className="builder-project-name">
            <span>PROJECT</span>
            <strong>{project.name}</strong>
          </div>

        </div>


        <div className="builder-center-controls">

          <button
            className={
              activeMode === "preview"
                ? "mode-btn active"
                : "mode-btn"
            }
            onClick={() => setActiveMode("preview")}
          >
            ◉ Preview
          </button>

          <button
            className={
              activeMode === "code"
                ? "mode-btn active"
                : "mode-btn"
            }
            onClick={() => setActiveMode("code")}
          >
            &lt;/&gt; Code
          </button>

        </div>
        <div className="builder-actions">

          <span
            className={
              saved
                ? "save-status saved"
                : "save-status"
            }
          >
            ● {saved ? "Saved" : "Unsaved"}
          </span>

<button
  className="icon-action"
  title="Undo"
  onClick={handleUndo}
  disabled={historyIndex <= 0}
>
  ↶
</button>

<button
  className="icon-action"
  title="Redo"
  onClick={handleRedo}
  disabled={historyIndex >= history.length - 1}
>
  ↷
</button>
          <button
            className="secondary-action"
            onClick={() => setShowExport(!showExport)}
          >
            Export
          </button>

          <button
            className="primary-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
                </div>
        </header>
        
      {/* EXPORT DROPDOWN */}

      {showExport && (
        <div className="export-menu">

          <div className="export-title">
            Export Project
          </div>

<button onClick={handleDownloadZip}>
  <span>↓</span>
  Download ZIP
</button>
<button onClick={handleExportCode}>
  <span>&lt;/&gt;</span>
  Export Code
</button>
          <button>
            <span>◆</span>
            GitHub
            <small>Coming soon</small>
          </button>

          <button>
            <span>▲</span>
            Vercel
            <small>Coming soon</small>
          </button>

        </div>
      )}


      {/* MAIN WORKSPACE */}

      <main className="builder-workspace">


        {/* LEFT AI SIDEBAR */}

        <aside className="builder-left">

          <div className="sidebar-heading">

            <div className="ai-orb">
              ✦
            </div>

            <div>
              <span>AI ASSISTANT</span>
              <h2>Build with AI</h2>
            </div>

          </div>


          <div className="ai-status">
            <span className="status-dot"></span>
            AI Ready
          </div>


          <textarea
            className="ai-prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              markChanged();
            }}
            placeholder="Describe what you want to build..."
          />


          <button
            className="generate-button"
            onClick={handleGenerate}
          >
            <span>✦</span>
            Generate Website
          </button>


          <div className="quick-section">

            <div className="quick-title">
              QUICK ACTIONS
            </div>

            <button
              onClick={() =>
                setPrompt(
                  "Make the website modern and professional"
                )
              }
            >
              ✨ Make it modern
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Create a beautiful responsive mobile design"
                )
              }
            >
              📱 Make responsive
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Improve the typography and spacing"
                )
              }
            >
              Aa Improve typography
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Add smooth animations and interactions"
                )
              }
            >
              ◈ Add animations
            </button>

          </div>


          <div className="ai-tip">

            <span>✦ AI TIP</span>

            <p>
              Be specific about colors, sections,
              style and functionality for better
              results.
            </p>

          </div>


          <button
            className="settings-button"
            onClick={() =>
              setShowSettings(!showSettings)
            }
          >
            ⚙ Project Settings
          </button>

        </aside>


{/* CENTER CODE EDITOR */}
{activeMode === "code" && (
<section className="builder-center">

          <div className="editor-toolbar">

            <div className="editor-title">
              <span className="live-dot"></span>
              Code Editor
            </div>

            <div className="editor-tabs">

              <button
                className={
                  activeTab === "html"
                    ? "editor-tab active"
                    : "editor-tab"
                }
                onClick={() => setActiveTab("html")}
              >
                HTML
              </button>

              <button
                className={
                  activeTab === "css"
                    ? "editor-tab active"
                    : "editor-tab"
                }
                onClick={() => setActiveTab("css")}
              >
                CSS
              </button>

              <button
                className={
                  activeTab === "js"
                    ? "editor-tab active"
                    : "editor-tab"
                }
                onClick={() => setActiveTab("js")}
              >
                JavaScript
              </button>

            </div>

            <div className="editor-actions">

              <button title="Format">
                ✨
              </button>

              <button title="More">
                ⋮
              </button>

            </div>

          </div>


          <div className="editor-body">

            <div className="line-numbers">

              {Array.from(
                {
                  length:
                    activeTab === "html"
                      ? htmlCode.split("\n").length
                      : activeTab === "css"
                      ? cssCode.split("\n").length
                      : jsCode.split("\n").length,
                },
                (_, index) => (
                  <span key={index}>
                    {index + 1}
                  </span>
                )
              )}

            </div>


            {activeTab === "html" && (
              <textarea
                className="premium-code-editor"
                value={htmlCode}
                onChange={(e) => {
                  setHtmlCode(e.target.value);
                  markChanged();
                }}
                spellCheck="false"
              />
            )}

            {activeTab === "css" && (
<textarea
  className="premium-code-editor"
  value={cssCode}
  onChange={(e) => {
    setCssCode(e.target.value);
    markChanged();
  }}
                spellCheck="false"
              />
            )}

            {activeTab === "js" && (
              <textarea
                className="premium-code-editor"
                value={jsCode}
                onChange={(e) => {
                  setJsCode(e.target.value);
                  markChanged();
                }}
                spellCheck="false"
              />
            )}

          </div>


          <div className="editor-footer">

            <span>
              UTF-8
            </span>

            <span>
              {activeTab === "html"
                ? "HTML"
                : activeTab === "css"
                ? "CSS"
                : "JavaScript"}
            </span>

            <span>
              Auto Preview
            </span>

          </div>

        </section>
)}


{/* RIGHT PREVIEW */}
{activeMode === "preview" && (
<section className="builder-right">

          <div className="preview-toolbar">

            <div className="preview-title">
              <span className="live-dot"></span>
              Live Preview
            </div>


            <div className="device-controls">

              <button
                className={
                  device === "desktop"
                    ? "device-btn active"
                    : "device-btn"
                }
                onClick={() => setDevice("desktop")}
              >
                ▣
              </button>

              <button
                className={
                  device === "tablet"
                    ? "device-btn active"
                    : "device-btn"
                }
                onClick={() => setDevice("tablet")}
              >
                ▯
              </button>

              <button
                className={
                  device === "mobile"
                    ? "device-btn active"
                    : "device-btn"
                }
                onClick={() => setDevice("mobile")}
              >
                ▯
              </button>

            </div>


            <div className="preview-actions">

              <button
                onClick={() =>
                  setFullscreen(!fullscreen)
                }
                title="Fullscreen"
              >
                ⛶
              </button>
<button
  onClick={() => setPreviewKey((prev) => prev + 1)}
  title="Refresh Preview"
>
  ↻
</button>
            </div>

          </div>


          <div className="preview-area">

            <div
              className={`preview-device ${device}`}
            >
              <iframe
  key={previewKey}
  title="Generated Website Preview"
  srcDoc={previewDocument}
  sandbox="allow-scripts"
/>
            </div>

          </div>


          <div className="preview-footer">

            <span>
              ● Live
            </span>

            <span>
              {device === "desktop"
                ? "Desktop"
                : device === "tablet"
                ? "Tablet"
                : "Mobile"}
            </span>

          </div>

        </section>

)}

      </main>


      {/* SETTINGS PANEL */}

      {showSettings && (
        <div
          className="settings-overlay"
          onClick={() => setShowSettings(false)}
        >

          <div
            className="settings-panel"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="settings-header">
              <div>
                <span>PROJECT</span>
                <h2>Settings</h2>
              </div>

              <button
                onClick={() =>
                  setShowSettings(false)
                }
              >
                ×
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>Project Name</strong>
                <p>{project.name}</p>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>Project Type</strong>
                <p>{project.type || "Website"}</p>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>Project ID</strong>
                <p>{projectId}</p>
              </div>
            </div>

          </div>

        </div>
      ) }

    </div>
  );

}
export default Builder;