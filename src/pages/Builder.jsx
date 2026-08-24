import { useEffect, useRef, useState } from "react";
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

  const [activeMode, setActiveMode] = useState("preview");
  const [activeTab, setActiveTab] = useState("html");

  const [device, setDevice] = useState("desktop");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const [generating, setGenerating] = useState(false);

  const [generationStage, setGenerationStage] =
    useState("idle");

  const [generationMessage, setGenerationMessage] =
    useState("");

  const [generationTime, setGenerationTime] =
    useState(0);

  const [showSettings, setShowSettings] =
    useState(false);

  const [showExport, setShowExport] =
    useState(false);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [previewKey, setPreviewKey] =
    useState(0);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] =
    useState(-1);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [copied, setCopied] = useState(false);

  const abortControllerRef = useRef(null);
  const generationTimerRef = useRef(null);

  /*
  ==========================================================
  LOAD PROJECT
  ==========================================================
  */

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const { data, error } =
          await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (error) {
          console.error(
            "Project loading error:",
            error
          );

          if (mounted) {
            setLoading(false);
          }

          return;
        }

        if (!mounted) return;

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

        const initialState = {
          html: data.html_code || "",
          css: data.css_code || "",
          js: data.js_code || "",
        };

        setHistory([initialState]);
        setHistoryIndex(0);

        setSaved(true);
        setLoading(false);
      } catch (error) {
        console.error(
          "Project loading error:",
          error
        );

        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      mounted = false;
    };
  }, [projectId, navigate]);

  /*
  ==========================================================
  CLEANUP
  ==========================================================
  */

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (generationTimerRef.current) {
        clearInterval(
          generationTimerRef.current
        );
      }
    };
  }, []);

  /*
  ==========================================================
  GENERATION TIMER
  ==========================================================
  */

  function startGenerationTimer() {
    setGenerationTime(0);

    if (generationTimerRef.current) {
      clearInterval(
        generationTimerRef.current
      );
    }

    generationTimerRef.current =
      setInterval(() => {
        setGenerationTime(
          (previous) => previous + 1
        );
      }, 1000);
  }

  function stopGenerationTimer() {
    if (generationTimerRef.current) {
      clearInterval(
        generationTimerRef.current
      );

      generationTimerRef.current = null;
    }
  }

  /*
  ==========================================================
  CURRENT STATE
  ==========================================================
  */

  function getCurrentState() {
    return {
      html: htmlCode,
      css: cssCode,
      js: jsCode,
    };
  }

  /*
  ==========================================================
  HISTORY
  ==========================================================
  */

  function pushHistory(state) {
    setHistory((previous) => {
      const base =
        historyIndex >= 0
          ? previous.slice(
              0,
              historyIndex + 1
            )
          : previous;

      const last =
        base[base.length - 1];

      if (
        last &&
        last.html === state.html &&
        last.css === state.css &&
        last.js === state.js
      ) {
        return base;
      }

      const next = [
        ...base,
        state,
      ].slice(-30);

      return next;
    });

    setHistoryIndex((previous) => {
      return Math.min(
        previous + 1,
        29
      );
    });
  }

  function handleUndo() {
    if (historyIndex <= 0) {
      return;
    }

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
  MANUAL CODE CHANGE
  ==========================================================
  */

  function updateHtml(value) {
    setHtmlCode(value);
    setSaved(false);
  }

  function updateCss(value) {
    setCssCode(value);
    setSaved(false);
  }

  function updateJs(value) {
    setJsCode(value);
    setSaved(false);
  }

  /*
  ==========================================================
  SAVE
  ==========================================================
  */

  async function handleSave() {
    if (!projectId) return;

    setSaving(true);

    const { error } =
      await supabase
        .from("projects")
        .update({
          prompt,
          html_code: htmlCode,
          css_code: cssCode,
          js_code: jsCode,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", projectId);

    setSaving(false);

    if (error) {
      console.error(
        "Save error:",
        error
      );

      alert("Save failed.");
      return;
    }

    setSaved(true);
  }

  /*
  ==========================================================
  SSE PARSER
  ==========================================================
  */

  async function* readSSEStream(
    response
  ) {
    if (!response.body) {
      throw new Error(
        "Streaming is not supported by this connection."
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const {
        value,
        done,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        }
      );

      const events =
        buffer.split("\n\n");

      buffer =
        events.pop() || "";

      for (const eventBlock of events) {
        const lines =
          eventBlock.split("\n");

        let eventName = "message";
        let dataText = "";

        for (const line of lines) {
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

        if (!dataText) {
          continue;
        }

        let data;

        try {
          data =
            JSON.parse(dataText);
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

    /*
    ========================================================
    FINAL BUFFER
    ========================================================
    */

    if (buffer.trim()) {
      const lines =
        buffer.split("\n");

      let eventName = "message";
      let dataText = "";

      for (const line of lines) {
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
          yield {
            event: eventName,
            data:
              JSON.parse(dataText),
          };
        } catch {
          // Ignore incomplete final event.
        }
      }
    }
  }

  /*
  ==========================================================
  GENERATE WEBSITE
  ==========================================================
  */

  async function handleGenerate() {
    if (!prompt.trim()) {
      alert(
        "Please describe what you want to build."
      );

      return;
    }

    if (generating) {
      return;
    }

    setGenerating(true);
    setErrorMessage("");
    setSaved(false);

    setGenerationStage(
      "thinking"
    );

    setGenerationMessage(
      "AI is thinking..."
    );

    setActiveMode("code");
    setActiveTab("html");

    /*
    --------------------------------------------------------
    Clear current code
    --------------------------------------------------------
    */

    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    /*
    --------------------------------------------------------
    Abort controller
    --------------------------------------------------------
    */

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    startGenerationTimer();

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

            body: JSON.stringify({
              prompt,

              currentCode: {
                html: htmlCode,
                css: cssCode,
                js: jsCode,
              },
            }),

            signal:
              controller.signal,
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
            errorData.message ||
            message;
        } catch {
          // Response was not JSON.
        }

        throw new Error(message);
      }

      let streamedHtml = "";
      let streamedCss = "";
      let streamedJs = "";

      for await (
        const item of readSSEStream(
          response
        )
      ) {
        const {
          event,
          data,
        } = item;

        /*
        ======================================================
        STATUS
        ======================================================
        */

        if (event === "status") {
          setGenerationStage(
            data.stage ||
              "generating"
          );

          setGenerationMessage(
            data.message ||
              "Generating..."
          );

          if (
            data.stage === "html"
          ) {
            setActiveTab("html");
          }

          if (
            data.stage === "css"
          ) {
            setActiveTab("css");
          }

          if (
            data.stage === "js"
          ) {
            setActiveTab("js");
          }
        }

        /*
        ======================================================
        CODE STREAM
        ======================================================
        */

        if (event === "code") {
          const type =
            data.type;

          const value =
            typeof data.value ===
            "string"
              ? data.value
              : "";

          if (type === "html") {
            streamedHtml =
              value;

            setHtmlCode(
              streamedHtml
            );

            setActiveTab(
              "html"
            );
          }

          if (type === "css") {
            streamedCss =
              value;

            setCssCode(
              streamedCss
            );

            setActiveTab(
              "css"
            );
          }

          if (type === "js") {
            streamedJs =
              value;

            setJsCode(
              streamedJs
            );

            setActiveTab(
              "js"
            );
          }

          /*
          ----------------------------------------------------
          Automatically switch to preview occasionally
          ----------------------------------------------------
          */

          setPreviewKey(
            (value) => value + 1
          );
        }

        /*
        ======================================================
        COMPLETE
        ======================================================
        */

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

          setGenerationStage(
            "complete"
          );

          setGenerationMessage(
            "Website ready"
          );

          setActiveMode(
            "preview"
          );

          setPreviewKey(
            (value) => value + 1
          );
        }

        /*
        ======================================================
        ERROR
        ======================================================
        */

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
        setGenerationStage(
          "stopped"
        );

        setGenerationMessage(
          "Generation stopped."
        );
      } else {
        console.error(
          "AI Generate Error:",
          error
        );

        setErrorMessage(
          error?.message ||
            "Something went wrong."
        );

        setGenerationStage(
          "error"
        );

        setGenerationMessage(
          "Generation failed."
        );

        alert(
          error?.message ||
            "AI generation failed."
        );
      }
    } finally {
      stopGenerationTimer();

      setGenerating(false);

      abortControllerRef.current =
        null;
    }
  }

  /*
  ==========================================================
  STOP GENERATION
  ==========================================================
  */

  function handleStopGeneration() {
    if (
      abortControllerRef.current
    ) {
      abortControllerRef.current.abort();
    }
  }

  /*
  ==========================================================
  ZIP EXPORT
  ==========================================================
  */

  async function handleDownloadZip() {
    try {
      const zip =
        new JSZip();

      const html =
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>${project?.name || "My Website"}</title>
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
          project?.name ||
          "website"
        }.zip`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

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
    const html =
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>${project?.name || "My Website"}</title>
  <link rel="stylesheet" href="style.css">
</head>

<body>

${htmlCode}

<script src="script.js"></script>

</body>
</html>`;

    const code =
`===== index.html =====

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
        project?.name ||
        "website"
      }-code.txt`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  }

  /*
  ==========================================================
  COPY CODE
  ==========================================================
  */

  async function handleCopyCode() {
    const code =
      activeTab === "html"
        ? htmlCode
        : activeTab === "css"
        ? cssCode
        : jsCode;

    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      alert(
        "Copy failed."
      );
    }
  }

  /*
  ==========================================================
  PREVIEW DOCUMENT
  ==========================================================
  */

  const previewDocument =
`<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<style>

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
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

try {

${jsCode || ""}

} catch (error) {

console.error(
  "Preview JavaScript error:",
  error
);

}

<\/script>

</body>

</html>`;

  /*
  ==========================================================
  CODE LENGTH
  ==========================================================
  */

  const currentCodeLength =
    activeTab === "html"
      ? htmlCode.length
      : activeTab === "css"
      ? cssCode.length
      : jsCode.length;

  /*
  ==========================================================
  LOADING SCREEN
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
          This project may have
          been deleted or moved.
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
  MAIN UI
  ==========================================================
  */

  return (
    <div
      className={`builder-page ${
        fullscreen
          ? "builder-fullscreen"
          : ""
      }`}
    >

      {/* ====================================================
          TOP BAR
      ==================================================== */}

      <header className="builder-topbar">

        <div className="builder-brand-area">

          <button
            className="builder-back"
            onClick={() =>
              navigate(
                "/dashboard"
              )
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

        {/* CENTER */}

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
              historyIndex <= 0
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

      {/* ====================================================
          EXPORT MENU
      ==================================================== */}

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

      {/* ====================================================
          WORKSPACE
      ==================================================== */}

      <main className="builder-workspace">

        {/* ==================================================
            AI SIDEBAR
        ================================================== */}

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

          {/* AI STATUS */}

          <div className="ai-status">

            <span
              className={
                generating
                  ? "status-dot generating"
                  : "status-dot"
              }
            />

            {generating
              ? generationMessage ||
                "AI Working..."
              : "AI Ready"}

          </div>

          {/* PROMPT */}

          <textarea
            className="ai-prompt"
            value={prompt}
            onChange={(event) => {
              setPrompt(
                event.target.value
              );

              setSaved(false);
            }}
            placeholder="Describe what you want to build..."
            disabled={generating}
          />

          <div className="prompt-meta">
            <span>
              {prompt.length}/10000
            </span>

            <span>
              AI Website Generator
            </span>
          </div>

          {/* GENERATE */}

          {!generating ? (
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
              className="generate-button stop"
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

          {/* GENERATION PROGRESS */}

          {generating && (
            <div className="generation-panel">

              <div className="generation-header">

                <span>
                  AI GENERATION
                </span>

                <strong>
                  {generationTime}s
                </strong>

              </div>

              <div className="generation-line">
                <div className="generation-pulse" />
              </div>

              <div className="generation-stage">

                <span>
                  {generationStage ===
                    "thinking" &&
                    "🧠"}

                  {generationStage ===
                    "html" &&
                    "⌨️"}

                  {generationStage ===
                    "css" &&
                    "🎨"}

                  {generationStage ===
                    "js" &&
                    "⚡"}

                  {generationStage ===
                    "connecting" &&
                    "🔗"}

                  {generationStage ===
                    "retry" &&
                    "↻"}
                </span>

                <div>

                  <strong>
                    {generationMessage ||
                      "Generating..."}
                  </strong>

                  <small>
                    Code is appearing
                    live
                  </small>

                </div>

              </div>

            </div>
          )}

          {/* ERROR */}

          {errorMessage && (
            <div className="ai-error">
              <strong>
                Generation error
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>
          )}

          {/* QUICK ACTIONS */}

          <div className="quick-section">

            <div className="quick-title">
              QUICK ACTIONS
            </div>

            <button
              onClick={() =>
                setPrompt(
                  "Make the website modern, premium and professional"
                )
              }
            >
              ✨ Make it modern
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Create a beautiful responsive mobile-first design"
                )
              }
            >
              📱 Make responsive
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Improve typography, spacing, colors and visual hierarchy"
                )
              }
            >
              Aa Improve design
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Add smooth animations and useful interactions"
                )
              }
            >
              ◈ Add interactions
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Create a premium ecommerce store with products, cart UI, categories and responsive design"
                )
              }
            >
              🛍️ Store website
            </button>

          </div>

          {/* TIP */}

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

        {/* ==================================================
            CODE EDITOR
        ================================================== */}

        {activeMode ===
          "code" && (
          <section className="builder-center">

            <div className="editor-toolbar">

              <div className="editor-title">

                <span className="live-dot" />

                {generating
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
                  title="Copy"
                  onClick={
                    handleCopyCode
                  }
                >
                  {copied
                    ? "✓"
                    : "⧉"}
                </button>

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

              </div>

            </div>

            {/* LIVE GENERATION BAR */}

            {generating && (
              <div className="live-generation-bar">

                <div className="typing-indicator">

                  <span />
                  <span />
                  <span />

                </div>

                <span>
                  {generationMessage ||
                    "AI is writing code..."}
                </span>

                <strong>
                  {generationTime}s
                </strong>

              </div>
            )}

            <div className="editor-body">

              <div className="line-numbers">

                {Array.from(
                  {
                    length:
                      (
                        activeTab ===
                        "html"
                          ? htmlCode
                          : activeTab ===
                            "css"
                          ? cssCode
                          : jsCode
                      ).split(
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
                  value={
                    htmlCode
                  }
                  onChange={(event) =>
                    updateHtml(
                      event.target
                        .value
                    )
                  }
                  spellCheck="false"
                />
              )}

              {activeTab ===
                "css" && (
                <textarea
                  className="premium-code-editor"
                  value={
                    cssCode
                  }
                  onChange={(event) =>
                    updateCss(
                      event.target
                        .value
                    )
                  }
                  spellCheck="false"
                />
              )}

              {activeTab ===
                "js" && (
                <textarea
                  className="premium-code-editor"
                  value={
                    jsCode
                  }
                  onChange={(event) =>
                    updateJs(
                      event.target
                        .value
                    )
                  }
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
                {currentCodeLength.toLocaleString()}
                {" "}characters
              </span>

              <span>
                {generating
                  ? "● Live"
                  : "Auto Preview"}
              </span>

            </div>

          </section>
        )}

        {/* ==================================================
            PREVIEW
        ================================================== */}

        {activeMode ===
          "preview" && (
          <section className="builder-right">

            <div className="preview-toolbar">

              <div className="preview-title">

                <span className="live-dot" />

                {generating
                  ? "Live AI Preview"
                  : "Live Preview"}

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
                  key={
                    previewKey
                  }
                  title="Generated Website Preview"
                  srcDoc={
                    previewDocument
                  }
                  sandbox="allow-scripts"
                />

                {generating && (
                  <div className="preview-generating">

                    <div className="preview-ai-orb">
                      ✦
                    </div>

                    <strong>
                      AI is building...
                    </strong>

                    <span>
                      {generationMessage ||
                        "Writing your website"}
                    </span>

                  </div>
                )}

              </div>

            </div>

            <div className="preview-footer">

              <span>
                ●{" "}
                {generating
                  ? "Generating"
                  : "Live"}
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

      {/* ====================================================
          SETTINGS
      ==================================================== */}

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
            onClick={(event) =>
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