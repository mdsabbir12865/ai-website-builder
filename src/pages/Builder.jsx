import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import JSZip from "jszip";

function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // =====================================================
  // PROJECT
  // =====================================================

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // CODE
  // =====================================================

  const [prompt, setPrompt] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  // =====================================================
  // UI
  // =====================================================

  const [activeTab, setActiveTab] = useState("html");
  const [activeMode, setActiveMode] = useState("code");
  const [device, setDevice] = useState("desktop");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [previewKey, setPreviewKey] = useState(0);

  // =====================================================
  // AI STREAMING
  // =====================================================

  const [generating, setGenerating] = useState(false);
  const [aiStage, setAiStage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [generationModel, setGenerationModel] = useState("");

  const abortControllerRef = useRef(null);

  // =====================================================
  // HISTORY
  // =====================================================

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // =====================================================
  // LOAD PROJECT
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
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

        if (cancelled) return;

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

        const initialState = {
          html: data.html_code || "",
          css: data.css_code || "",
          js: data.js_code || "",
        };

        historyRef.current = [initialState];
        historyIndexRef.current = 0;

        setHistory([initialState]);
        setHistoryIndex(0);

        setSaved(true);
        setLoading(false);
      } catch (error) {
        console.error("Project load error:", error);
        setLoading(false);
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId, navigate]);

  // =====================================================
  // CURRENT STATE
  // =====================================================

  const getCurrentCode = useCallback(() => {
    return {
      html: htmlCode,
      css: cssCode,
      js: jsCode,
    };
  }, [htmlCode, cssCode, jsCode]);

  // =====================================================
  // HISTORY
  // =====================================================

  function pushHistory(nextState) {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    const trimmed = currentHistory.slice(
      0,
      currentIndex + 1
    );

    const last = trimmed[trimmed.length - 1];

    if (
      last &&
      last.html === nextState.html &&
      last.css === nextState.css &&
      last.js === nextState.js
    ) {
      return;
    }

    const newHistory = [
      ...trimmed,
      nextState,
    ].slice(-50);

    const newIndex = newHistory.length - 1;

    historyRef.current = newHistory;
    historyIndexRef.current = newIndex;

    setHistory(newHistory);
    setHistoryIndex(newIndex);
  }

  function markChanged(nextState = null) {
    setSaved(false);

    if (nextState) {
      pushHistory(nextState);
    }
  }

  function handleUndo() {
    const currentIndex = historyIndexRef.current;

    if (currentIndex <= 0) return;

    const newIndex = currentIndex - 1;
    const previous = historyRef.current[newIndex];

    historyIndexRef.current = newIndex;

    setHistoryIndex(newIndex);

    setHtmlCode(previous.html);
    setCssCode(previous.css);
    setJsCode(previous.js);

    setSaved(false);
    setPreviewKey((value) => value + 1);
  }

  function handleRedo() {
    const currentIndex = historyIndexRef.current;

    if (
      currentIndex >=
      historyRef.current.length - 1
    ) {
      return;
    }

    const newIndex = currentIndex + 1;
    const next = historyRef.current[newIndex];

    historyIndexRef.current = newIndex;

    setHistoryIndex(newIndex);

    setHtmlCode(next.html);
    setCssCode(next.css);
    setJsCode(next.js);

    setSaved(false);
    setPreviewKey((value) => value + 1);
  }

  // =====================================================
  // SAVE
  // =====================================================

  async function handleSave() {
    if (!projectId || saving) return;

    setSaving(true);

    try {
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

      if (error) {
        throw error;
      }

      setSaved(true);
    } catch (error) {
      console.error("Save error:", error);
      alert(
        error?.message ||
        "Save failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // SSE PARSER
  // =====================================================
async function* readSSEStream(response) {
    if (!response.body) {
      throw new Error(
        "Streaming is not supported by this response."
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const events = buffer.split(
        "\n\n"
      );

      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const lines = rawEvent.split("\n");

        let eventName = "message";
        let dataText = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line
              .slice(6)
              .trim();
          }

          if (line.startsWith("data:")) {
            dataText += line
              .slice(5)
              .trim();
          }
        }

        if (!dataText) continue;

        let data;

        try {
          data = JSON.parse(dataText);
        } catch {
          console.warn(
            "Invalid SSE data:",
            dataText
          );
          continue;
        }

        yield {
          event: eventName,
          data,
        };
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split("\n");

      let eventName = "message";
      let dataText = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line
            .slice(6)
            .trim();
        }

        if (line.startsWith("data:")) {
          dataText += line
            .slice(5)
            .trim();
        }
      }

      if (dataText) {
        try {
          yield {
            event: eventName,
            data: JSON.parse(dataText),
          };
        } catch {
          // Ignore incomplete final chunk.
        }
      }
    }
  }

  // =====================================================
  // GENERATE WEBSITE
  // =====================================================

  async function handleGenerate() {
    if (generating) return;

    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      alert(
        "Please describe what you want to build."
      );
      return;
    }

    setGenerating(true);
    setAiError("");
    setAiStage("thinking");
    setAiMessage("AI is thinking...");
    setGenerationModel("");

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    const oldCode = getCurrentCode();

    let streamedHtml = "";
    let streamedCss = "";
    let streamedJs = "";

    try {
      const response = await fetch(
        "/api/generate-stream",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "text/event-stream",
          },
          body: JSON.stringify({
            prompt: cleanPrompt,
            currentCode: oldCode,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let message =
          `Server error (${response.status})`;

        try {
          const text =
            await response.text();

          if (text) {
            try {
              const parsed =
                JSON.parse(text);

              message =
                parsed.error ||
                parsed.message ||
                message;
            } catch {
              if (text.length < 500) {
                message = text;
              }
            }
          }
        } catch {
          // Ignore response parsing error.
        }

        throw new Error(message);
      }

      for await (
        const packet of readSSEStream(
          response
        )
      ) {
        const { event, data } =
          packet;

        // ---------------------------------------------
        // STATUS
        // ---------------------------------------------

        if (event === "status") {
          setAiStage(
            data.stage || "generating"
          );

          setAiMessage(
            data.message ||
            "Generating..."
          );

          if (data.model) {
            setGenerationModel(
              data.model
            );
          }

          continue;
        }

        // ---------------------------------------------
        // CODE
        // ---------------------------------------------

        if (event === "code") {
          const type = data.type;

          if (type === "html") {
            streamedHtml =
              data.value ||
              streamedHtml +
                (data.delta || "");

            setHtmlCode(
              streamedHtml
            );
          }

          if (type === "css") {
            streamedCss =
              data.value ||
              streamedCss +
                (data.delta || "");

            setCssCode(
              streamedCss
            );
          }

          if (type === "js") {
            streamedJs =
              data.value ||
              streamedJs +
                (data.delta || "");

            setJsCode(
              streamedJs
            );
          }

          setSaved(false);

          // Live preview update
          setPreviewKey(
            (value) => value + 1
          );

          continue;
        }

        // ---------------------------------------------
        // COMPLETE
        // ---------------------------------------------

        if (event === "complete") {
          const finalHtml =
            data.html ||
            streamedHtml ||
            "";

          const finalCss =
            data.css ||
            streamedCss ||
            "";

          const finalJs =
            data.js ||
            streamedJs ||
            "";

          setHtmlCode(finalHtml);
          setCssCode(finalCss);
          setJsCode(finalJs);

          pushHistory({
            html: finalHtml,
            css: finalCss,
            js: finalJs,
          });

          setSaved(false);

          setAiStage("complete");
          setAiMessage(
            "Website generated successfully."
          );

          if (data.model) {
            setGenerationModel(
              data.model
            );
          }

          setPreviewKey(
            (value) => value + 1
          );

          // Automatically show preview
          setActiveMode("preview");

          continue;
        }

        // ---------------------------------------------
        // ERROR
        // ---------------------------------------------

        if (event === "error") {
          throw new Error(
            data.message ||
            "AI generation failed."
          );
        }
      }
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        setAiStage("stopped");
        setAiMessage(
          "Generation stopped."
        );
      } else {
        console.error(
          "AI streaming error:",
          error
        );

        const message =
          error?.message ||
          "Something went wrong while generating.";

        setAiError(message);
        setAiStage("error");
        setAiMessage(
          "Generation failed."
        );
      }
    } finally {
      setGenerating(false);
      abortControllerRef.current =
        null;
    }
  }

  // =====================================================
  // STOP GENERATION
  // =====================================================

  function handleStopGeneration() {
    if (
      abortControllerRef.current
    ) {
      abortControllerRef.current.abort();
    }
  }

  // =====================================================
  // RETRY
  // =====================================================

  function handleRetry() {
    if (generating) return;

    setAiError("");
    handleGenerate();
  }

  // =====================================================
  // ZIP EXPORT
  // =====================================================

  async function handleDownloadZip() {
    if (!project) return;

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
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `${project.name || "website"}.zip`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
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

  // =====================================================
  // CODE EXPORT
  // =====================================================

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

    const blob = new Blob(
      [code],
      {
        type:
          "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `${project.name || "website"}-code.txt`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // =====================================================
  // PREVIEW
  // =====================================================

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
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

* {
  box-sizing: border-box;
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

  // =====================================================
  // LOADING
  // =====================================================

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

  // =====================================================
  // PROJECT ERROR
  // =====================================================

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
            navigate("/dashboard")
          }
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div
      className={`builder-page ${
        fullscreen
          ? "builder-fullscreen"
          : ""
      }`}
    >

      {/* =================================================
          TOP BAR
      ================================================= */}

      <header className="builder-topbar">

        <div className="builder-brand-area">

          <button
            className="builder-back"
            onClick={() =>
              navigate("/dashboard")
            }
            title="Back"
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

        {/* MODE */}

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
              activeMode === "code"
                ? "mode-btn active"
                : "mode-btn"
            }
            onClick={() =>
              setActiveMode("code")
            }
          >
            &lt;/&gt; Code
          </button>

        </div>

        {/* ACTIONS */}

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
              historyIndex <= 0 ||
              generating
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
                history.length - 1 ||
              generating
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
              saving ||
              generating
            }
          >
            {saving
              ? "Saving..."
              : "Save"}
          </button>

        </div>

      </header>

      {/* =================================================
          EXPORT
      ================================================= */}

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
            <span>↓</span>
            Download ZIP
          </button>

          <button
            onClick={
              handleExportCode
            }
          >
            <span>
              &lt;/&gt;
            </span>
            Export Code
          </button>

          <button disabled>
            <span>◆</span>
            GitHub
            <small>
              Coming soon
            </small>
          </button>

          <button disabled>
            <span>▲</span>
            Vercel
            <small>
              Coming soon
            </small>
          </button>

        </div>
      )}

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="builder-workspace">

        {/* =================================================
            LEFT AI PANEL
        ================================================= */}

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

          <div className="ai-status">

            <span
              className={
                generating
                  ? "status-dot generating"
                  : aiError
                  ? "status-dot error"
                  : "status-dot"
              }
            />

            {generating
              ? aiMessage ||
                "Generating..."
              : aiError
              ? "AI Error"
              : "AI Ready"}

          </div>

          {/* AI PROGRESS */}

          {(generating ||
            aiStage ===
              "complete" ||
            aiError) && (
            <div className="ai-progress">

              <div className="ai-progress-header">

                <span>
                  {generating
                    ? "GENERATING"
                    : aiStage ===
                      "complete"
                    ? "COMPLETED"
                    : "ERROR"}
                </span>

                {generationModel && (
                  <small>
                    {generationModel}
                  </small>
                )}

              </div>

              <div className="ai-progress-bar">

                <div
                  className={
                    generating
                      ? "ai-progress-fill running"
                      : "ai-progress-fill"
                  }
                />

              </div>

              <p>
                {aiMessage}
              </p>

            </div>
          )}

          {/* ERROR */}

          {aiError && (
            <div className="ai-error">

              <strong>
                Generation failed
              </strong>

              <p>
                {aiError}
              </p>

              <div className="ai-error-actions">

                <button
                  onClick={
                    handleRetry
                  }
                >
                  Retry
                </button>

                <button
                  onClick={() =>
                    setAiError("")
                  }
                >
                  Dismiss
                </button>

              </div>

            </div>
          )}

          {/* PROMPT */}

          <textarea
            className="ai-prompt"
            value={prompt}
            onChange={(e) => {
              setPrompt(
                e.target.value
              );
              setSaved(false);
            }}
            disabled={generating}
            placeholder="Describe what you want to build..."
          />

          {/* GENERATE / STOP */}

          {generating ? (
            <button
              className="generate-button generating-button"
              onClick={
                handleStopGeneration
              }
            >
              <span>
                ■
              </span>

              Stop Generation
            </button>
          ) : (
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
          )}

          {/* QUICK ACTIONS */}

          <div className="quick-section">

            <div className="quick-title">
              QUICK ACTIONS
            </div>

            <button
              disabled={generating}
              onClick={() =>
                setPrompt(
                  "Make the website modern and professional"
                )
              }
            >
              ✨ Make it modern
            </button>

            <button
              disabled={generating}
              onClick={() =>
                setPrompt(
                  "Create a beautiful responsive mobile design"
                )
              }
            >
              📱 Make responsive
            </button>

            <button
              disabled={generating}
              onClick={() =>
                setPrompt(
                  "Improve the typography, spacing and visual hierarchy"
                )
              }
            >
              Aa Improve typography
            </button>

            <button
              disabled={generating}
              onClick={() =>
                setPrompt(
                  "Add smooth animations and useful interactions"
                )
              }
            >
              ◈ Add animations
            </button>

            <button
              disabled={generating}
              onClick={() =>
                setPrompt(
                  "Make the website look premium and production-ready"
                )
              }
            >
              ✦ Make it premium
            </button>

          </div>

          {/* TIP */}

          <div className="ai-tip">

            <span>
              ✦ AI TIP
            </span>

            <p>
              Be specific about colors,
              sections, style,
              functionality and target
              audience for better results.
            </p>

          </div>

          {/* SETTINGS */}

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

        {/* =================================================
            CODE EDITOR
        ================================================= */}

        {activeMode ===
          "code" && (
          <section className="builder-center">

            <div className="editor-toolbar">

              <div className="editor-title">

                <span className="live-dot" />

                Code Editor

                {generating && (
                  <span className="typing-indicator">
                    AI writing...
                  </span>
                )}

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
                  title="Refresh Preview"
                  onClick={() =>
                    setPreviewKey(
                      (value) =>
                        value + 1
                    )
                  }
                >
                  ↻
                </button>

                <button
                  title="Clear current editor"
                  onClick={() => {

                    if (
                      generating
                    )
                      return;

                    const next = {
                      ...getCurrentCode(),
                      [activeTab]:
                        "",
                    };

                    setHtmlCode(
                      next.html
                    );

                    setCssCode(
                      next.css
                    );

                    setJsCode(
                      next.js
                    );

                    markChanged(
                      next
                    );
                  }}
                >
                  ×
                </button>

              </div>

            </div>

            <div className="editor-body">

              <div className="line-numbers">

                {Array.from(
                  {
                    length:
                      activeTab ===
                      "html"
                        ? htmlCode.split(
                            "\n"
                          ).length
                        : activeTab ===
                          "css"
                        ? cssCode.split(
                            "\n"
                          ).length
                        : jsCode.split(
                            "\n"
                          ).length,
                  },
                  (_, index) => (
                    <span
                      key={index}
                    >
                      {index + 1}
                    </span>
                  )
                )}

              </div>

              {activeTab ===
                "html" && (
                <textarea
                  className="premium-code-editor"
                  value={htmlCode}
                  onChange={(e) => {

                    const value =
                      e.target.value;

                    setHtmlCode(
                      value
                    );

                    setSaved(
                      false
                    );
                  }}
                  spellCheck="false"
                />
              )}

              {activeTab ===
                "css" && (
                <textarea
                  className="premium-code-editor"
                  value={cssCode}
                  onChange={(e) => {

                    const value =
                      e.target.value;

                    setCssCode(
                      value
                    );

                    setSaved(
                      false
                    );
                  }}
                  spellCheck="false"
                />
              )}

              {activeTab ===
                "js" && (
                <textarea
                  className="premium-code-editor"
                  value={jsCode}
                  onChange={(e) => {

                    const value =
                      e.target.value;

                    setJsCode(
                      value
                    );

                    setSaved(
                      false
                    );
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
                {activeTab ===
                "html"
                  ? "HTML"
                  : activeTab ===
                    "css"
                  ? "CSS"
                  : "JavaScript"}
              </span>

              <span>
                {generating
                  ? "AI Streaming"
                  : "Auto Preview"}
              </span>

            </div>

          </section>
        )}

        {/* =================================================
            PREVIEW
        ================================================= */}

        {activeMode ===
          "preview" && (
          <section className="builder-right">

            <div className="preview-toolbar">

              <div className="preview-title">

                <span className="live-dot" />

                Live Preview

                {generating && (
                  <span className="preview-generating">
                    Updating...
                  </span>
                )}

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
                  title="Desktop"
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
                  title="Tablet"
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
                  title="Mobile"
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
                  key={previewKey}
                  title="Generated Website Preview"
                  srcDoc={
                    previewDocument
                  }
                  sandbox="allow-scripts"
                />

                {generating &&
                  !htmlCode && (
                    <div className="preview-loading">
                      <div>
                        <div className="preview-loader">
                          ✦
                        </div>

                        <strong>
                          AI is building...
                        </strong>

                        <span>
                          {aiMessage}
                        </span>
                      </div>
                    </div>
                  )}

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

              {generating && (
                <span>
                  AI streaming
                </span>
              )}

            </div>

          </section>
        )}

      </main>

      {/* =================================================
          SETTINGS
      ================================================= */}

      {showSettings && (
        <div
          className="settings-overlay"
          onClick={() =>
            setShowSettings(false)
          }
        >

          <div
            className="settings-panel"
            onClick={(e) =>
              e.stopPropagation()
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

            <div className="setting-row">
              <div>
                <strong>
                  AI Model
                </strong>

                <p>
                  {generationModel ||
                    "Automatic model selection"}
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