import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { supabase } from "../lib/supabase";

import JSZip from "jszip";

function Builder() {
  const { projectId } = useParams();

  const navigate = useNavigate();

  /*
  ========================================================
  PROJECT
  ========================================================
  */

  const [project, setProject] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  /*
  ========================================================
  CODE
  ========================================================
  */

  const [prompt, setPrompt] =
    useState("");

  const [htmlCode, setHtmlCode] =
    useState("");

  const [cssCode, setCssCode] =
    useState("");

  const [jsCode, setJsCode] =
    useState("");

  /*
  ========================================================
  UI
  ========================================================
  */

  const [activeTab, setActiveTab] =
    useState("html");

  const [activeMode, setActiveMode] =
    useState("code");

  const [device, setDevice] =
    useState("desktop");

  const [fullscreen, setFullscreen] =
    useState(false);

  const [previewKey, setPreviewKey] =
    useState(0);

  /*
  ========================================================
  AI STATE
  ========================================================
  */

  const [generating, setGenerating] =
    useState(false);

  const [generationStage, setGenerationStage] =
    useState("");

  const [generationMessage, setGenerationMessage] =
    useState("");

  const [generationModel, setGenerationModel] =
    useState("");

  const [generationProgress, setGenerationProgress] =
    useState(0);

  const [generationError, setGenerationError] =
    useState("");

  const abortController =
    useRef(null);

  /*
  ========================================================
  SAVE
  ========================================================
  */

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(true);

  /*
  ========================================================
  HISTORY
  ========================================================
  */

  const [history, setHistory] =
    useState([]);

  const [historyIndex, setHistoryIndex] =
    useState(-1);

  /*
  ========================================================
  OTHER UI
  ========================================================
  */

  const [showSettings, setShowSettings] =
    useState(false);

  const [showExport, setShowExport] =
    useState(false);

  /*
  ========================================================
  LOAD PROJECT
  ========================================================
  */

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const {
          data,
          error,
        } =
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

        setPrompt(
          data.prompt || ""
        );

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
          html:
            data.html_code || "",

          css:
            data.css_code || "",

          js:
            data.js_code || "",
        };

        setHistory([
          initialState,
        ]);

        setHistoryIndex(0);

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
  }, [
    projectId,
    navigate,
  ]);

  /*
  ========================================================
  CURRENT CODE
  ========================================================
  */

  const currentCode = useMemo(
    () => ({
      html: htmlCode,
      css: cssCode,
      js: jsCode,
    }),
    [
      htmlCode,
      cssCode,
      jsCode,
    ]
  );

  /*
  ========================================================
  HISTORY
  ========================================================
  */

  function pushHistory(nextState) {
    setHistory(
      (previous) => {
        const trimmed =
          previous.slice(
            0,
            historyIndex + 1
          );

        return [
          ...trimmed,
          nextState,
        ].slice(-30);
      }
    );

    setHistoryIndex(
      (previous) =>
        Math.min(
          previous + 1,
          29
        )
    );
  }

  function markChanged() {
    setSaved(false);
  }

  /*
  ========================================================
  UNDO
  ========================================================
  */

  function handleUndo() {
    if (
      historyIndex <= 0
    ) {
      return;
    }

    const previous =
      history[
        historyIndex - 1
      ];

    if (!previous) return;

    setHtmlCode(
      previous.html
    );

    setCssCode(
      previous.css
    );

    setJsCode(
      previous.js
    );

    setHistoryIndex(
      historyIndex - 1
    );

    setSaved(false);

    setPreviewKey(
      (value) =>
        value + 1
    );
  }

  /*
  ========================================================
  REDO
  ========================================================
  */

  function handleRedo() {
    if (
      historyIndex >=
      history.length - 1
    ) {
      return;
    }

    const next =
      history[
        historyIndex + 1
      ];

    if (!next) return;

    setHtmlCode(
      next.html
    );

    setCssCode(
      next.css
    );

    setJsCode(
      next.js
    );

    setHistoryIndex(
      historyIndex + 1
    );

    setSaved(false);

    setPreviewKey(
      (value) =>
        value + 1
    );
  }

  /*
  ========================================================
  SAVE
  ========================================================
  */

  async function handleSave() {
    if (saving) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "You are not logged in."
        );
      }

      const {
        error,
      } =
        await supabase
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
          )
          .eq(
            "user_id",
            user.id
          );

      if (error) {
        throw error;
      }

      setSaved(true);
    } catch (error) {
      console.error(
        "Save error:",
        error
      );

      alert(
        error?.message ||
          "Save failed."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  ========================================================
  SSE PARSER
  ========================================================
  */

  function parseSSEChunk(
    buffer,
    onEvent
  ) {
    const events =
      buffer.split("\n\n");

    const remaining =
      events.pop() || "";

    for (
      const eventBlock of events
    ) {
      const lines =
        eventBlock.split("\n");

      let eventName =
        "message";

      let data = "";

      for (
        const line of lines
      ) {
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
          data +=
            line
              .slice(5)
              .trim();
        }
      }

      if (!data) continue;

      try {
        const parsed =
          JSON.parse(data);

        onEvent(
          eventName,
          parsed
        );
      } catch (error) {
        console.warn(
          "Invalid SSE event:",
          data,
          error
        );
      }
    }

    return remaining;
  }

  /*
  ========================================================
  GENERATE WITH GEMINI
  ========================================================
  */

  async function handleGenerate() {
    if (generating) {
      return;
    }

    if (!prompt.trim()) {
      alert(
        "Please describe what you want to build."
      );

      return;
    }

    setGenerating(true);

    setGenerationError("");

    setGenerationStage(
      "thinking"
    );

    setGenerationMessage(
      "Understanding your idea..."
    );

    setGenerationModel("");

    setGenerationProgress(3);

    setActiveMode("code");

    /*
    Clear current code so
    streaming appears naturally.
    */

    setHtmlCode("");
    setCssCode("");
    setJsCode("");

    abortController.current =
      new AbortController();

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

              currentCode,
            }),

            signal:
              abortController
                .current
                .signal,
          }
        );

      /*
      ------------------------------------------
      RESPONSE ERROR
      ------------------------------------------
      */

      if (!response.ok) {
        let message =
          "AI generation failed.";

        try {
          const errorData =
            await response.json();

          message =
            errorData.error ||
            message;
        } catch {}

        throw new Error(
          message
        );
      }

      if (!response.body) {
        throw new Error(
          "Streaming is not supported by this response."
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder(
          "utf-8"
        );

      let buffer = "";

      let streamedHTML = "";

      let streamedCSS = "";

      let streamedJS = "";

      let receivedComplete =
        false;

      let receivedError =
        false;

      /*
      ======================================================
      READ STREAM
      ======================================================
      */

      while (true) {
        const {
          value,
          done,
        } =
          await reader.read();

        if (done) break;

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        buffer =
          parseSSEChunk(
            buffer,
            (
              event,
              data
            ) => {
              /*
              ----------------------------------
              STATUS
              ----------------------------------
              */

              if (
                event ===
                "status"
              ) {
                setGenerationStage(
                  data.stage || ""
                );

                setGenerationMessage(
                  data.message ||
                    "Generating..."
                );

                if (
                  data.model
                ) {
                  setGenerationModel(
                    data.model
                  );
                }

                const progressMap = {
                  thinking: 5,
                  connecting: 10,
                  generating: 15,
                  html: 35,
                  css: 65,
                  js: 85,
                  retrying: 10,
                  complete: 100,
                };

                const progress =
                  progressMap[
                    data.stage
                  ];

                if (
                  progress !==
                  undefined
                ) {
                  setGenerationProgress(
                    progress
                  );
                }
              }

              /*
              ----------------------------------
              CODE
              ----------------------------------
              */

              if (
                event ===
                "code"
              ) {
                if (
                  data.type ===
                  "html"
                ) {
                  streamedHTML =
                    data.value ||
                    streamedHTML;

                  setHtmlCode(
                    streamedHTML
                  );

                  setGenerationProgress(
                    Math.min(
                      60,
                      15 +
                        Math.floor(
                          streamedHTML.length /
                            150
                        )
                    )
                  );
                }

                if (
                  data.type ===
                  "css"
                ) {
                  streamedCSS =
                    data.value ||
                    streamedCSS;

                  setCssCode(
                    streamedCSS
                  );

                  setGenerationProgress(
                    Math.min(
                      85,
                      55 +
                        Math.floor(
                          streamedCSS.length /
                            200
                        )
                    )
                  );
                }

                if (
                  data.type ===
                  "js"
                ) {
                  streamedJS =
                    data.value ||
                    streamedJS;

                  setJsCode(
                    streamedJS
                  );

                  setGenerationProgress(
                    Math.min(
                      98,
                      80 +
                        Math.floor(
                          streamedJS.length /
                            300
                        )
                    )
                  );
                }

                setSaved(false);
              }

              /*
              ----------------------------------
              COMPLETE
              ----------------------------------
              */

              if (
                event ===
                "complete"
              ) {
                receivedComplete =
                  true;

                const finalHTML =
                  data.html ||
                  streamedHTML;

                const finalCSS =
                  data.css ||
                  streamedCSS;

                const finalJS =
                  data.js ||
                  streamedJS;

                setHtmlCode(
                  finalHTML
                );

                setCssCode(
                  finalCSS
                );

                setJsCode(
                  finalJS
                );

                setGenerationProgress(
                  100
                );

                setGenerationStage(
                  "complete"
                );

                setGenerationMessage(
                  "Website generated successfully."
                );

                if (
                  data.model
                ) {
                  setGenerationModel(
                    data.model
                  );
                }

                const finalState = {
                  html:
                    finalHTML,

                  css:
                    finalCSS,

                  js:
                    finalJS,
                };

                /*
                Add generated version
                to history.
                */

                setHistory(
                  (previous) => {
                    const current =
                      previous[
                        previous.length -
                          1
                      ];

                    if (
                      current &&
                      current.html ===
                        finalState.html &&
                      current.css ===
                        finalState.css &&
                      current.js ===
                        finalState.js
                    ) {
                      return previous;
                    }

                    return [
                      ...previous,
                      finalState,
                    ].slice(-30);
                  }
                );

                setHistoryIndex(
                  (previous) =>
                    Math.min(
                      previous + 1,
                      29
                    )
                );

                setSaved(false);

                setPreviewKey(
                  (value) =>
                    value + 1
                );

                setActiveMode(
                  "preview"
                );
              }

              /*
              ----------------------------------
              ERROR
              ----------------------------------
              */

              if (
                event ===
                "error"
              ) {
                receivedError =
                  true;

                setGenerationError(
                  data.message ||
                    "AI generation failed."
                );

                setGenerationStage(
                  "error"
                );
              }
            }
          );
      }

      /*
      ======================================================
      FALLBACK IF STREAM CLOSED
      ======================================================
      */

      if (
        !receivedComplete &&
        !receivedError &&
        (
          streamedHTML ||
          streamedCSS ||
          streamedJS
        )
      ) {
        setHtmlCode(
          streamedHTML
        );

        setCssCode(
          streamedCSS
        );

        setJsCode(
          streamedJS
        );

        setGenerationStage(
          "complete"
        );

        setGenerationProgress(
          100
        );

        setGenerationMessage(
          "Generation finished."
        );

        setActiveMode(
          "preview"
        );

        setSaved(false);

        setPreviewKey(
          (value) =>
            value + 1
        );
      }
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        setGenerationStage(
          "cancelled"
        );

        setGenerationMessage(
          "Generation cancelled."
        );
      } else {
        console.error(
          "Gemini Generate Error:",
          error
        );

        setGenerationStage(
          "error"
        );

        setGenerationError(
          error?.message ||
            "Something went wrong while generating."
        );
      }
    } finally {
      setGenerating(false);

      abortController.current =
        null;
    }
  }

  /*
  ========================================================
  CANCEL GENERATION
  ========================================================
  */

  function handleCancelGeneration() {
    if (
      abortController.current
    ) {
      abortController.current.abort();
    }

    setGenerating(false);

    setGenerationStage(
      "cancelled"
    );

    setGenerationMessage(
      "Generation cancelled."
    );
  }

  /*
  ========================================================
  PREVIEW DOCUMENT
  ========================================================
  */

  const previewDocument =
    useMemo(
      () => `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<style>

html,
body {
  margin: 0;
  min-height: 100%;
  overflow-x: hidden;
}

* {
  box-sizing: border-box;
}

${cssCode}

</style>

</head>

<body>

${htmlCode}

<script>

try {

${jsCode}

} catch (error) {

console.error(
  "Generated website error:",
  error
);

}

<\/script>

</body>

</html>
`,
      [
        htmlCode,
        cssCode,
        jsCode,
      ]
    );

  /*
  ========================================================
  DOWNLOAD ZIP
  ========================================================
  */

  async function handleDownloadZip() {
    if (!project) return;

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

<title>${
          project.name ||
          "My Website"
        }</title>

<link
  rel="stylesheet"
  href="style.css"
>

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
        cssCode
      );

      zip.file(
        "script.js",
        jsCode
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

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
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
  ========================================================
  EXPORT CODE
  ========================================================
  */

  function handleExportCode() {
    if (!project) return;

    const content =
      `===== index.html =====

<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${
        project.name ||
        "My Website"
      }</title>

<link
  rel="stylesheet"
  href="style.css"
>

</head>

<body>

${htmlCode}

<script src="script.js"></script>

</body>

</html>


===== style.css =====

${cssCode}


===== script.js =====

${jsCode}
`;

    const blob =
      new Blob(
        [content],
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

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );
  }

  /*
  ========================================================
  LOADING
  ========================================================
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
  ========================================================
  PROJECT ERROR
  ========================================================
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
  ========================================================
  RENDER
  ========================================================
  */

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

        {/* CENTER MODE */}

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
                (value) =>
                  !value
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

      {/* EXPORT MENU */}

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
            ◆ GitHub

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

        {/* AI SIDEBAR */}

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
              generating
                ? "generating"
                : ""
            }`}
          >

            <span className="status-dot" />

            {generating
              ? "Gemini Generating..."
              : "Gemini Ready"}

          </div>

          <textarea
            className="ai-prompt"
            value={prompt}
            onChange={(event) => {
              setPrompt(
                event.target.value
              );

              markChanged();
            }}
            placeholder="Describe what you want to build..."
            disabled={
              generating
            }
          />

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
              className="generate-button"
              onClick={
                handleCancelGeneration
              }
            >

              <span>
                ■
              </span>

              Stop Generation

            </button>
          )}

          {/* AI PROGRESS */}

          {(generating ||
            generationStage ===
              "complete") && (
            <div className="ai-generation-panel">

              <div className="ai-generation-top">

                <span>
                  {generationMessage}
                </span>

                <strong>
                  {generationProgress}%
                </strong>

              </div>

              <div className="ai-progress">

                <div
                  className="ai-progress-fill"
                  style={{
                    width:
                      `${generationProgress}%`,
                  }}
                />

              </div>

              {generationModel && (
                <small>
                  Powered by{" "}
                  {generationModel ===
                  "gemini-3-flash-preview"
                    ? "Gemini 3 Flash"
                    : generationModel}
                </small>
              )}

            </div>
          )}

          {/* ERROR */}

          {generationError && (
            <div className="ai-error">

              <strong>
                Generation failed
              </strong>

              <p>
                {generationError}
              </p>

              <button
                onClick={
                  handleGenerate
                }
              >
                Try Again
              </button>

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
                  "Make the website modern, premium and professional."
                )
              }
            >
              ✨ Make it modern
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Create a beautiful responsive mobile-first design."
                )
              }
            >
              📱 Make responsive
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Improve typography, spacing, hierarchy and visual polish."
                )
              }
            >
              Aa Improve typography
            </button>

            <button
              onClick={() =>
                setPrompt(
                  "Add smooth professional animations and useful interactions."
                )
              }
            >
              ◈ Add animations
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

          <button
            className="settings-button"
            onClick={() =>
              setShowSettings(
                true
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

                {generating
                  ? "Gemini Live Code"
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

              {activeTab ===
                "html" && (
                <textarea
                  className="premium-code-editor"
                  value={
                    htmlCode
                  }
                  onChange={(
                    event
                  ) => {
                    setHtmlCode(
                      event.target
                        .value
                    );

                    markChanged();
                  }}
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
                  onChange={(
                    event
                  ) => {
                    setCssCode(
                      event.target
                        .value
                    );

                    markChanged();
                  }}
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
                  onChange={(
                    event
                  ) => {
                    setJsCode(
                      event.target
                        .value
                    );

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
                  ? "● Gemini live generation"
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
                      (value) =>
                        !value
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
                  title="Refresh"
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
                  sandbox="allow-scripts allow-forms"
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