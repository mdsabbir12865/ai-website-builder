import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import JSZip from "jszip";
import { supabase } from "../lib/supabase";

function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  const [activeTab, setActiveTab] = useState("html");
  const [activeMode, setActiveMode] = useState("code");
  const [device, setDevice] = useState("desktop");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [previewKey, setPreviewKey] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStage, setAiStage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [generationError, setGenerationError] = useState("");

  const abortRef = useRef(null);
  const generationIdRef = useRef(0);

  /*
  ==========================================================
  LOAD PROJECT
  ==========================================================
  */

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        navigate("/login", {
          replace: true,
        });
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (!mounted) return;

      if (error) {
        console.error(
          "Project loading error:",
          error
        );

        setLoading(false);
        return;
      }

      setProject(data);
      setPrompt(data.prompt || "");

      setHtmlCode(
        data.html_code || ""
      );

      setCssCode(
        data.css_code || ""
      );

      setJsCode(
        data.js_code || ""
      );

      setHistory([
        {
          html: data.html_code || "",
          css: data.css_code || "",
          js: data.js_code || "",
        },
      ]);

      setHistoryIndex(0);
      setLoading(false);
    }

    loadProject();

    return () => {
      mounted = false;

      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [projectId, navigate]);

  /*
  ==========================================================
  CURRENT CODE
  ==========================================================
  */

  const currentCode = useMemo(
    () => ({
      html: htmlCode,
      css: cssCode,
      js: jsCode,
    }),
    [htmlCode, cssCode, jsCode]
  );

  /*
  ==========================================================
  HISTORY
  ==========================================================
  */

  function pushHistory(nextState) {
    setHistory((prev) => {
      const base =
        historyIndex >= 0
          ? prev.slice(
              0,
              historyIndex + 1
            )
          : [];

      const last =
        base[base.length - 1];

      if (
        last &&
        last.html === nextState.html &&
        last.css === nextState.css &&
        last.js === nextState.js
      ) {
        return base;
      }

      const next = [
        ...base,
        nextState,
      ].slice(-30);

      setHistoryIndex(
        next.length - 1
      );

      return next;
    });
  }

  function markChanged() {
    setSaved(false);
  }

  function handleUndo() {
    if (historyIndex <= 0) return;

    const previous =
      history[historyIndex - 1];

    if (!previous) return;

    setHtmlCode(previous.html);
    setCssCode(previous.css);
    setJsCode(previous.js);

    setHistoryIndex(
      historyIndex - 1
    );

    setSaved(false);
    setPreviewKey(
      (value) => value + 1
    );
  }

  function handleRedo() {
    if (
      historyIndex >=
      history.length - 1
    ) {
      return;
    }

    const next =
      history[historyIndex + 1];

    if (!next) return;

    setHtmlCode(next.html);
    setCssCode(next.css);
    setJsCode(next.js);

    setHistoryIndex(
      historyIndex + 1
    );

    setSaved(false);
    setPreviewKey(
      (value) => value + 1
    );
  }

  /*
  ==========================================================
  SSE PARSER
  ==========================================================
  */

  async function readSSEStream(
    response,
    onEvent
  ) {
    if (!response.body) {
      throw new Error(
        "Streaming is not supported by this browser."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(
        value,
        { stream: true }
      );

      const events =
        buffer.split("\n\n");

      buffer =
        events.pop() || "";

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;

        let eventName = "message";
        let dataText = "";

        const lines =
          rawEvent.split(/\r?\n/);

        for (const line of lines) {
          if (
            line.startsWith(
              "event:"
            )
          ) {
            eventName =
              line
                .slice(6)
                .trim();
          }

          if (
            line.startsWith(
              "data:"
            )
          ) {
            dataText +=
              line
                .slice(5)
                .trim();
          }
        }

        if (!dataText) continue;

        try {
          const data =
            JSON.parse(dataText);

          await onEvent(
            eventName,
            data
          );
        } catch (error) {
          console.warn(
            "Invalid SSE event:",
            error
          );
        }
      }
    }

    const remaining =
      buffer.trim();

    if (remaining) {
      let eventName = "message";
      let dataText = "";

      for (const line of remaining.split(
        /\r?\n/
      )) {
        if (
          line.startsWith("event:")
        ) {
          eventName =
            line
              .slice(6)
              .trim();
        }

        if (
          line.startsWith("data:")
        ) {
          dataText +=
            line
              .slice(5)
              .trim();
        }
      }

      if (dataText) {
        try {
          await onEvent(
            eventName,
            JSON.parse(dataText)
          );
        } catch {
          // Ignore incomplete final event.
        }
      }
    }
  }

  /*
  ==========================================================
  GENERATE WEBSITE — REAL TIME STREAM
  ==========================================================
  */

  async function handleGenerate() {
    if (isGenerating) return;

    const cleanPrompt =
      prompt.trim();

    if (!cleanPrompt) {
      alert(
        "Please describe what you want to build."
      );
      return;
    }

    /*
    Cancel previous request.
    */

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller =
      new AbortController();

    abortRef.current =
      controller;

    const generationId =
      ++generationIdRef.current;

    setIsGenerating(true);
    setGenerationError("");
    setAiStage("starting");
    setAiMessage(
      "Starting AI..."
    );

    /*
    Clear editor immediately so user sees
    the new generation coming in.
    */

    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    setActiveMode("code");
    setActiveTab("html");

    try {
      const response =
        await fetch(
          "/api/generate-stream",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "text/event-stream",
            },

            cache: "no-store",

            signal:
              controller.signal,

            body: JSON.stringify({
              prompt:
                cleanPrompt,

              currentCode,
            }),
          }
        );

      if (!response.ok) {
        let message =
          "AI generation failed.";

        try {
          const errorData =
            await response.json();

          message =
            errorData.error ||
            message;
        } catch {
          // Ignore invalid JSON.
        }

        throw new Error(
          message
        );
      }

      let streamedHtml = "";
      let streamedCss = "";
      let streamedJs = "";

      await readSSEStream(
        response,
        async (
          eventName,
          data
        ) => {
          /*
          Ignore events from an old request.
          */

          if (
            generationId !==
            generationIdRef.current
          ) {
            return;
          }

          /*
          STATUS
          */

          if (
            eventName ===
            "status"
          ) {
            setAiStage(
              data.stage ||
                "working"
            );

            setAiMessage(
              data.message ||
                "AI is working..."
            );

            return;
          }

          /*
          CODE STREAM
          */

          if (
            eventName ===
            "code"
          ) {
            const type =
              data.type;

            const value =
              typeof data.value ===
              "string"
                ? data.value
                : "";

            if (
              type === "html"
            ) {
              streamedHtml =
                value;

              setHtmlCode(
                value
              );

              /*
              Stay on HTML while
              HTML is being written.
              */

              setActiveTab(
                "html"
              );
            }

            if (
              type === "css"
            ) {
              streamedCss =
                value;

              setCssCode(
                value
              );

              /*
              Automatically move to CSS
              when CSS generation begins.
              */

              setActiveTab(
                "css"
              );
            }

            if (
              type === "js"
            ) {
              streamedJs =
                value;

              setJsCode(
                value
              );

              setActiveTab(
                "js"
              );
            }

            /*
            Keep editor mode visible.
            */

            setActiveMode(
              "code"
            );

            return;
          }

          /*
          COMPLETE
          */

          if (
            eventName ===
            "complete"
          ) {
            const finalHtml =
              data.html ??
              streamedHtml ??
              "";

            const finalCss =
              data.css ??
              streamedCss ??
              "";

            const finalJs =
              data.js ??
              streamedJs ??
              "";

            setHtmlCode(
              finalHtml
            );

            setCssCode(
              finalCss
            );

            setJsCode(
              finalJs
            );

            pushHistory({
              html: finalHtml,
              css: finalCss,
              js: finalJs,
            });

            setSaved(false);

            setPreviewKey(
              (value) =>
                value + 1
            );

            setAiStage(
              "complete"
            );

            setAiMessage(
              "Website generated successfully."
            );

            /*
            Automatically show preview
            after the full stream finishes.
            */

            setTimeout(() => {
              if (
                generationId ===
                generationIdRef.current
              ) {
                setActiveMode(
                  "preview"
                );
              }
            }, 250);

            return;
          }

          /*
          ERROR
          */

          if (
            eventName ===
            "error"
          ) {
            throw new Error(
              data.message ||
                "AI generation failed."
            );
          }
        }
      );

      /*
      If stream ended without complete,
      keep whatever was streamed.
      */

      if (
        streamedHtml ||
        streamedCss ||
        streamedJs
      ) {
        setHtmlCode(
          streamedHtml
        );

        setCssCode(
          streamedCss
        );

        setJsCode(
          streamedJs
        );

        setSaved(false);
      }
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "AI Generate Error:",
        error
      );

      setGenerationError(
        error?.message ||
          "AI generation failed."
      );

      setAiStage(
        "error"
      );

      setAiMessage(
        error?.message ||
          "AI generation failed."
      );
    } finally {
      if (
        generationId ===
        generationIdRef.current
      ) {
        setIsGenerating(false);
      }
    }
  }

  /*
  ==========================================================
  STOP GENERATION
  ==========================================================
  */

  function handleStopGeneration() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setIsGenerating(false);
    setAiStage("stopped");
    setAiMessage(
      "Generation stopped."
    );
  }

  /*
  ==========================================================
  SAVE
  ==========================================================
  */

  async function handleSave() {
    if (saving) return;

    setSaving(true);

    const {
      error,
    } = await supabase
      .from("projects")
      .update({
        prompt,

        html_code:
          htmlCode,

        css_code:
          cssCode,

        js_code:
          jsCode,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        projectId
      );

    setSaving(false);

    if (error) {
      console.error(
        "Save error:",
        error
      );

      alert(
        "Save failed."
      );

      return;
    }

    setSaved(true);
  }

  /*
  ==========================================================
  ZIP EXPORT
  ==========================================================
  */

  async function handleDownloadZip() {
    if (!project) return;

    try {
      const zip =
        new JSZip();

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

      zip.file(
        "index.html",
        html
      );

      zip.file(
        "style.css",
        cssCode || ""
      );

      zip.file(
        "script.js",
        jsCode || ""
      );

      const blob =
        await zip.generateAsync({
          type: "blob",
        });

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `${
          project.name ||
          "website"
        }.zip`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );
    } catch (error) {
      console.error(
        "ZIP export error:",
        error
      );

      alert(
        "ZIP export failed."
      );
    }
  }

  /*
  ==========================================================
  EXPORT CODE
  ==========================================================
  */

  function handleExportCode() {
    if (!project) return;

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

    const blob =
      new Blob(
        [code],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `${
        project.name ||
        "website"
      }-code.txt`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  /*
  ==========================================================
  PREVIEW DOCUMENT
  ==========================================================
  */

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
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

${cssCode || ""}

</style>
</head>

<body>

${htmlCode || ""}

<script>
try {
${jsCode || ""}
} catch (error) {
  console.error("Preview JavaScript error:", error);
}
<\/script>

</body>
</html>
`;

  /*
  ==========================================================
  LOADING
  ==========================================================
  */

  if (loading) {
    return (
      <div className="builder-loading">
        <div className="builder-loader-orb">
          ✦
        </div>

        <h2>
          Preparing your workspace...
        </h2>

        <p>
          Loading project
        </p>
      </div>
    );
  }

  /*
  ==========================================================
  PROJECT ERROR
  ==========================================================
  */

  if (!project) {
    return (
      <div className="builder-error">
        <div className="error-icon">
          !
        </div>

        <h2>
          Project not found
        </h2>

        <p>
          This project may have been
          deleted or moved.
        </p>

        <button
          onClick={() =>
            navigate(
              "/dashboard"
            )
          }
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  /*
  ==========================================================
  RENDER
  ==========================================================
  */

  const editorValue =
    activeTab === "html"
      ? htmlCode
      : activeTab === "css"
      ? cssCode
      : jsCode;

  const lineCount =
    Math.max(
      1,
      editorValue.split("\n")
        .length
    );

  return (
    <div
      className={`builder-page ${
        fullscreen
          ? "builder-fullscreen"
          : ""
      }`}
    >
      {/* TOP BAR */}

      <header className="builder-topbar">

        <div className="builder-brand-area">

          <button
            className="builder-back"
            onClick={() =>
              navigate(
                "/dashboard"
              )
            }
          >
            ←
          </button>

          <div className="builder-brand">

            <div className="builder-logo">
              ✦
            </div>

            <div>
              <strong>
                WebAI
              </strong>

              <span>
                BUILDER
              </span>
            </div>

          </div>

          <div className="builder-divider" />

          <div className="builder-project-name">

            <span>
              PROJECT
            </span>

            <strong>
              {project.name}
            </strong>

          </div>

        </div>

        <div className="builder-center-controls">

          <button
            className={
              activeMode ===
              "preview"
                ? "mode-btn active"
                : "mode-btn"
            }
            onClick={() =>
              setActiveMode(
                "preview"
              )
            }
          >
            ◉ Preview
          </button>

          <button
            className={
              activeMode ===
              "code"
                ? "mode-btn active"
                : "mode-btn"
            }
            onClick={() =>
              setActiveMode(
                "code"
              )
            }
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
            ●{" "}
            {saved
              ? "Saved"
              : "Unsaved"}
          </span>

          <button
            className="icon-action"
            title="Undo"
            onClick={
              handleUndo
            }
            disabled={
              historyIndex <=
              0
            }
          >
            ↶
          </button>

          <button
            className="icon-action"
            title="Redo"
            onClick={
              handleRedo
            }
            disabled={
              historyIndex >=
              history.length - 1
            }
          >
            ↷
          </button>

          <button
            className="secondary-action"
            onClick={() =>
              setShowExport(
                !showExport
              )
            }
          >
            Export
          </button>

          <button
            className="primary-save"
            onClick={
              handleSave
            }
            disabled={
              saving
            }
          >
            {saving
              ? "Saving..."
              : "Save"}
          </button>

        </div>

      </header>

      {/* EXPORT */}

      {showExport && (
        <div className="export-menu">

          <div className="export-title">
            Export Project
          </div>

          <button
            onClick={
              handleDownloadZip
            }
          >
            ↓ Download ZIP
          </button>

          <button
            onClick={
              handleExportCode
            }
          >
            &lt;/&gt; Export Code
          </button>

          <button>
            ◇ GitHub
            <small>
              Coming soon
            </small>
          </button>

          <button>
            ▲ Vercel
            <small>
              Coming soon
            </small>
          </button>

        </div>
      )}

      {/* WORKSPACE */}

      <main className="builder-workspace">

        {/* LEFT AI */}

        <aside className="builder-left">

          <div className="sidebar-heading">

            <div className="ai-orb">
              ✦
            </div>

            <div>
              <span>
                AI ASSISTANT
              </span>

              <h2>
                Build with AI
              </h2>
            </div>

          </div>

          <div
            className={`ai-status ${
              isGenerating
                ? "generating"
                : ""
            }`}
          >
            <span className="status-dot" />

            {isGenerating
              ? "AI Generating..."
              : "AI Ready"}
          </div>

          <textarea
            className="ai-prompt"
            value={prompt}
            disabled={
              isGenerating
            }
            onChange={(event) => {
              setPrompt(
                event.target.value
              );
              markChanged();
            }}
            placeholder="Describe what you want to build..."
          />

          {!isGenerating ? (
            <button
              className="generate-button"
              onClick={
                handleGenerate
              }
            >
              <span>
                ✦
              </span>

              Generate Website
            </button>
          ) : (
            <button
              className="generate-button"
              onClick={
                handleStopGeneration
              }
            >
              <span>
                ■
              </span>

              Stop Generation
            </button>
          )}

          {/* LIVE AI STATUS */}

          {(isGenerating ||
            aiMessage ||
            generationError) && (
            <div className="ai-live-status">

              <div className="ai-live-title">
                {isGenerating
                  ? "● LIVE"
                  : aiStage ===
                    "complete"
                  ? "✓ COMPLETE"
                  : "AI STATUS"}
              </div>

              <div className="ai-live-message">
                {aiMessage ||
                  "AI is working..."}
              </div>

              {isGenerating && (
                <div className="ai-progress">
                  <span />
                </div>
              )}

              {generationError && (
                <div className="ai-error">
                  {generationError}
                </div>
              )}

            </div>
          )}

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
                  "Improve typography, spacing and visual hierarchy"
                )
              }
            >
              Aa Improve typography
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Add smooth animations and useful interactions"
                )
              }
            >
              ◈ Add animations
            </button>

          </div>

          <div className="ai-tip">

            <span>
              ✦ AI TIP
            </span>

            <p>
              Be specific about
              colors, sections,
              style and functionality
              for better results.
            </p>

          </div>

          <button
            className="settings-button"
            onClick={() =>
              setShowSettings(
                !showSettings
              )
            }
          >
            ⚙ Project Settings
          </button>

        </aside>

        {/* CODE EDITOR */}

        {activeMode ===
          "code" && (
          <section className="builder-center">

            <div className="editor-toolbar">

              <div className="editor-title">
                <span className="live-dot" />

                {isGenerating
                  ? "AI Live Code"
                  : "Code Editor"}
              </div>

              <div className="editor-tabs">

                <button
                  className={
                    activeTab ===
                    "html"
                      ? "editor-tab active"
                      : "editor-tab"
                  }
                  onClick={() =>
                    setActiveTab(
                      "html"
                    )
                  }
                >
                  HTML
                </button>

                <button
                  className={
                    activeTab ===
                    "css"
                      ? "editor-tab active"
                      : "editor-tab"
                  }
                  onClick={() =>
                    setActiveTab(
                      "css"
                    )
                  }
                >
                  CSS
                </button>

                <button
                  className={
                    activeTab ===
                    "js"
                      ? "editor-tab active"
                      : "editor-tab"
                  }
                  onClick={() =>
                    setActiveTab(
                      "js"
                    )
                  }
                >
                  JavaScript
                </button>

              </div>

              <div className="editor-actions">

                <button
                  title="Refresh"
                  onClick={() =>
                    setPreviewKey(
                      (value) =>
                        value + 1
                    )
                  }
                >
                  ↻
                </button>

              </div>

            </div>

            <div className="editor-body">

              <div className="line-numbers">

                {Array.from(
                  {
                    length:
                      lineCount,
                  },
                  (
                    _,
                    index
                  ) => (
                    <span
                      key={
                        index
                      }
                    >
                      {index + 1}
                    </span>
                  )
                )}

              </div>

              <textarea
                className="premium-code-editor"
                value={
                  editorValue
                }
                onChange={(
                  event
                ) => {

                  const value =
                    event
                      .target
                      .value;

                  if (
                    activeTab ===
                    "html"
                  ) {
                    setHtmlCode(
                      value
                    );
                  }

                  if (
                    activeTab ===
                    "css"
                  ) {
                    setCssCode(
                      value
                    );
                  }

                  if (
                    activeTab ===
                    "js"
                  ) {
                    setJsCode(
                      value
                    );
                  }

                  markChanged();
                }}
                spellCheck="false"
              />

            </div>

            <div className="editor-footer">

              <span>
                UTF-8
              </span>

              <span>
                {activeTab ===
                "html"
                  ? "HTML"
                  : activeTab ===
                    "css"
                  ? "CSS"
                  : "JavaScript"}
              </span>

              <span>
                {isGenerating
                  ? "● Streaming"
                  : "Auto Preview"}
              </span>

            </div>

          </section>
        )}

        {/* PREVIEW */}

        {activeMode ===
          "preview" && (
          <section className="builder-right">

            <div className="preview-toolbar">

              <div className="preview-title">
                <span className="live-dot" />

                Live Preview
              </div>

              <div className="device-controls">

                <button
                  className={
                    device ===
                    "desktop"
                      ? "device-btn active"
                      : "device-btn"
                  }
                  onClick={() =>
                    setDevice(
                      "desktop"
                    )
                  }
                >
                  ▣
                </button>

                <button
                  className={
                    device ===
                    "tablet"
                      ? "device-btn active"
                      : "device-btn"
                  }
                  onClick={() =>
                    setDevice(
                      "tablet"
                    )
                  }
                >
                  ▯
                </button>

                <button
                  className={
                    device ===
                    "mobile"
                      ? "device-btn active"
                      : "device-btn"
                  }
                  onClick={() =>
                    setDevice(
                      "mobile"
                    )
                  }
                >
                  ▯
                </button>

              </div>

              <div className="preview-actions">

                <button
                  onClick={() =>
                    setFullscreen(
                      !fullscreen
                    )
                  }
                  title="Fullscreen"
                >
                  ⛶
                </button>

                <button
                  onClick={() =>
                    setPreviewKey(
                      (value) =>
                        value + 1
                    )
                  }
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
                  key={
                    previewKey
                  }
                  title="Generated Website Preview"
                  srcDoc={
                    previewDocument
                  }
                  sandbox="allow-scripts"
                />
              </div>

            </div>

            <div className="preview-footer">

              <span>
                ● Live
              </span>

              <span>
                {device ===
                "desktop"
                  ? "Desktop"
                  : device ===
                    "tablet"
                  ? "Tablet"
                  : "Mobile"}
              </span>

            </div>

          </section>
        )}

      </main>

      {/* SETTINGS */}

      {showSettings && (
        <div
          className="settings-overlay"
          onClick={() =>
            setShowSettings(
              false
            )
          }
        >
          <div
            className="settings-panel"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="settings-header">

              <div>
                <span>
                  PROJECT
                </span>

                <h2>
                  Settings
                </h2>
              </div>

              <button
                onClick={() =>
                  setShowSettings(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="setting-row">
              <div>
                <strong>
                  Project Name
                </strong>

                <p>
                  {project.name}
                </p>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>
                  Project Type
                </strong>

                <p>
                  {project.type ||
                    "Website"}
                </p>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>
                  Project ID
                </strong>

                <p>
                  {projectId}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Builder;