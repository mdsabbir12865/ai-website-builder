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
import FileUpload from "../components/FileUpload";

function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  /* ========================================================
     PROJECT
  ======================================================== */
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ========================================================
     CODE
  ======================================================== */
  const [prompt, setPrompt] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  /* ========================================================
     ATTACHMENTS (NEW)
  ======================================================== */
  const [attachedFiles, setAttachedFiles] = useState([]);

  /* ========================================================
     UI
  ======================================================== */
  const [activeTab, setActiveTab] = useState("html");
  const [activeMode, setActiveMode] = useState("code");
  const [device, setDevice] = useState("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  /* ========================================================
     AI STATE
  ======================================================== */
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationModel, setGenerationModel] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [generationMode, setGenerationMode] = useState("generate");

  const abortController = useRef(null);

  /* ========================================================
     SAVE / HISTORY
  ======================================================== */
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);

  const autoSaveTimer = useRef(null);
  const historyTimer = useRef(null);

  const latestCodeRef = useRef({ html: "", css: "", js: "" });
  const isLoadedRef = useRef(false);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);

  /* ========================================================
     LOAD PROJECT
  ======================================================== */
  useEffect(() => {
    let mounted = true;
    async function loadProject() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login", { replace: true }); return; }

        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Project loading error:", error);
          if (mounted) setLoading(false);
          return;
        }

        if (!mounted) return;
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

        setHistory([initialState]);
        setHistoryIndex(0);
        latestCodeRef.current = initialState;
        isLoadedRef.current = true;
        setLoading(false);
      } catch (error) {
        console.error("Project loading error:", error);
        if (mounted) setLoading(false);
      }
    }
    loadProject();
    return () => { mounted = false; };
  }, [projectId, navigate]);

  const currentCode = useMemo(() => ({
    html: htmlCode,
    css: cssCode,
    js: jsCode,
  }), [htmlCode, cssCode, jsCode]);

  useEffect(() => {
    latestCodeRef.current = currentCode;
  }, [currentCode]);

  /* ========================================================
     ATTACHMENT HANDLERS
  ======================================================== */
  function handleAttachFile(fileData) {
    setAttachedFiles((prev) => {
      if (prev.find(f => f.id === fileData.id)) return prev;
      return [...prev, fileData];
    });
  }

  function removeAttachment(id) {
    setAttachedFiles((prev) => prev.filter(f => f.id !== id));
  }

  /* ========================================================
     HISTORY & SAVE
  ======================================================== */
  function pushHistory(nextState) {
    setHistory((previous) => {
      const currentIndex = Math.max(0, Math.min(historyIndex, previous.length - 1));
      const current = previous[currentIndex];
      if (current && current.html === nextState.html && current.css === nextState.css && current.js === nextState.js) {
        return previous;
      }
      const trimmed = previous.slice(0, currentIndex + 1);
      const nextHistory = [...trimmed, nextState].slice(-30);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }

  function handleManualCodeChange(type, value) {
    const nextState = { ...latestCodeRef.current, [type]: value };
    latestCodeRef.current = nextState;
    if (type === "html") setHtmlCode(value);
    if (type === "css") setCssCode(value);
    if (type === "js") setJsCode(value);
    setSaved(false);

    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      pushHistory({ ...latestCodeRef.current });
      historyTimer.current = null;
    }, 450);
  }

  async function saveProjectData({ silent = false } = {}) {
    if (!projectId || !isLoadedRef.current) return false;
    if (!silent) setSaving(true); else setAutoSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in.");
      const { error } = await supabase.from("projects").update({
        prompt,
        html_code: latestCodeRef.current.html,
        css_code: latestCodeRef.current.css,
        js_code: latestCodeRef.current.js,
        updated_at: new Date().toISOString(),
      }).eq("id", projectId).eq("user_id", user.id);
      if (error) throw error;
      setSaved(true);
      return true;
    } catch (error) {
      console.error("Save error:", error);
      return false;
    } finally {
      if (!silent) setSaving(false); else setAutoSaving(false);
    }
  }

  useEffect(() => {
    if (!projectId || !isLoadedRef.current || saved || generating) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveProjectData({ silent: true });
      autoSaveTimer.current = null;
    }, 1800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [prompt, htmlCode, cssCode, jsCode, saved, generating, projectId]);

  /* ========================================================
     UNDO / REDO
  ======================================================== */
  function handleUndo() {
    if (historyIndex <= 0) return;
    const previous = history[historyIndex - 1];
    setHtmlCode(previous.html);
    setCssCode(previous.css);
    setJsCode(previous.js);
    latestCodeRef.current = previous;
    setHistoryIndex(historyIndex - 1);
    setSaved(false);
    setPreviewKey(v => v + 1);
  }

  function handleRedo() {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHtmlCode(next.html);
    setCssCode(next.css);
    setJsCode(next.js);
    latestCodeRef.current = next;
    setHistoryIndex(historyIndex + 1);
    setSaved(false);
    setPreviewKey(v => v + 1);
  }

  /* ========================================================
     SSE PARSER
  ======================================================== */
  function parseSSEChunk(buffer, onEvent) {
    const events = buffer.split("\n\n");
    const remaining = events.pop() || "";
    for (const eventBlock of events) {
      const lines = eventBlock.split("\n");
      let eventName = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try { onEvent(eventName, JSON.parse(data)); } catch (e) {}
    }
    return remaining;
  }

  /* ========================================================
     GENERATE
  ======================================================== */
  async function handleGenerate(mode = "generate") {
    if (generating) return;
    if (!prompt.trim() && attachedFiles.length === 0) {
      alert("Please describe what to build or attach a design reference.");
      return;
    }

    setGenerating(true);
    setGenerationMode(mode);
    setGenerationError("");
    setGenerationStage("thinking");
    setGenerationMessage(attachedFiles.length > 0 ? "Analyzing design reference..." : "Thinking...");
    setGenerationProgress(5);
    setActiveMode("code");

    if (mode === "generate") {
      setHtmlCode(""); setCssCode(""); setJsCode("");
      latestCodeRef.current = { html: "", css: "", js: "" };
    }

    abortController.current = new AbortController();

    try {
      const response = await fetch("/api/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          mode,
          currentCode,
          projectId,
          images: attachedFiles, // Pass images to AI
        }),
        signal: abortController.current.signal,
      });

      if (!response.ok) throw new Error("Generation failed.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let sHTML = "", sCSS = "", sJS = "";
      let receivedComplete = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSSEChunk(buffer, (event, data) => {
          if (event === "status") {
            setGenerationStage(data.stage);
            setGenerationMessage(data.message);
            if (data.model) setGenerationModel(data.model);
            const pMap = { thinking: 5, connecting: 12, generating: 20, html: 40, css: 70, js: 90, complete: 100 };
            if (pMap[data.stage]) setGenerationProgress(pMap[data.stage]);
          }
          if (event === "code") {
            if (data.type === "html") { sHTML = data.value; setHtmlCode(sHTML); }
            if (data.type === "css") { sCSS = data.value; setCssCode(sCSS); }
            if (data.type === "js") { sJS = data.value; setJsCode(sJS); }
            latestCodeRef.current = { html: sHTML, css: sCSS, js: sJS };
            setSaved(false);
          }
          if (event === "complete") {
            receivedComplete = true;
            setHtmlCode(data.html); setCssCode(data.css); setJsCode(data.js);
            latestCodeRef.current = { html: data.html, css: data.css, js: data.js };
            setGenerationProgress(100);
            setGenerationStage("complete");
            setGenerationMessage("Finished successfully.");
            pushHistory({ ...latestCodeRef.current });
            setPreviewKey(v => v + 1);
            setActiveMode("preview");
          }
          if (event === "error") throw new Error(data.message);
        });
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setGenerationStage("error");
        setGenerationError(error.message);
      }
    } finally {
      setGenerating(false);
      setAttachedFiles([]); // Clear attachments after use
      abortController.current = null;
    }
  }

  function handleCancelGeneration() {
    if (abortController.current) abortController.current.abort();
    setGenerating(false);
    setGenerationStage("cancelled");
  }

  /* ========================================================
     PREVIEW DOC
  ======================================================== */
  const previewDocument = useMemo(() => `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>html,body{margin:0;min-height:100%;overflow-x:hidden;}*{box-sizing:border-box;}${cssCode}</style>
    </head><body>${htmlCode}<script>try{${jsCode}}catch(e){console.error(e);}</script></body></html>
  `, [htmlCode, cssCode, jsCode]);

  /* ========================================================
     ZIP & EXPORT
  ======================================================== */
  async function handleDownloadZip() {
    const zip = new JSZip();
    zip.file("index.html", `<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body>${htmlCode}<script src="script.js"></script></body></html>`);
    zip.file("style.css", cssCode);
    zip.file("script.js", jsCode);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${project.name}.zip`; link.click();
  }

  if (loading) return <div className="builder-loading"><div className="builder-loader-orb">✦</div><h2>Loading workspace...</h2></div>;
  if (!project) return <div className="builder-error"><h2>Project not found</h2><button onClick={() => navigate("/dashboard")}>Back</button></div>;

  return (
    <div className={`builder-page ${fullscreen ? "builder-fullscreen" : ""}`}>
      <header className="builder-topbar">
        <div className="builder-brand-area">
          <button className="builder-back" onClick={() => navigate("/dashboard")}>←</button>
          <div className="builder-brand"><div className="builder-logo">✦</div><strong>WebAI</strong></div>
          <div className="builder-project-name"><span>PROJECT</span><strong>{project.name}</strong></div>
        </div>
        <div className="builder-center-controls">
          <button className={activeMode === "preview" ? "mode-btn active" : "mode-btn"} onClick={() => setActiveMode("preview")}>◉ Preview</button>
          <button className={activeMode === "code" ? "mode-btn active" : "mode-btn"} onClick={() => setActiveMode("code")}>&lt;/&gt; Code</button>
        </div>
        <div className="builder-actions">
          <span className={`save-status ${saved ? "saved" : ""}`}>{autoSaving ? "Saving..." : saved ? "Saved" : "Unsaved"}</span>
          <button className="icon-action" onClick={handleUndo} disabled={historyIndex <= 0}>↶</button>
          <button className="icon-action" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>↷</button>
          <button className="secondary-action" onClick={() => setShowExport(!showExport)}>Export</button>
          <button className="primary-save" onClick={() => saveProjectData()} disabled={saving || generating}>Save</button>
        </div>
      </header>

      {showExport && (
        <div className="export-menu">
          <button onClick={handleDownloadZip}>↓ Download ZIP</button>
          <button onClick={() => setShowExport(false)}>Close</button>
        </div>
      )}

      <main className="builder-workspace">
        <aside className="builder-left">
          <div className="sidebar-heading">
            <div className="ai-orb">✦</div>
            <div><span>AI ASSISTANT</span><h2>Build with AI</h2></div>
          </div>

          {/* ATTACHMENTS PREVIEW AREA */}
          {attachedFiles.length > 0 && (
            <div className="attached-assets-bar">
              {attachedFiles.map(file => (
                <div key={file.id} className="attachment-chip">
                  <img src={file.url} alt="Ref" />
                  <span className="chip-name">{file.name}</span>
                  <button onClick={() => removeAttachment(file.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="ai-prompt"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setSaved(false); }}
            placeholder={attachedFiles.length > 0 ? "Explain how to use this design..." : "Describe what you want to build..."}
            disabled={generating}
          />

          {!generating ? (
            <div className="gen-button-group">
              <button className="generate-button" onClick={() => handleGenerate("generate")}>
                <span>✦</span> {attachedFiles.length > 0 ? "Generate from Design" : "Generate Website"}
              </button>
              <button className="generate-button ai-edit-button" onClick={() => handleGenerate("edit")} disabled={!htmlCode}>
                <span>✎</span> Edit with AI
              </button>
            </div>
          ) : (
            <button className="generate-button stop" onClick={handleCancelGeneration}>
              <span>■</span> Stop Generation
            </button>
          )}

          {(generating || generationStage === "complete") && (
            <div className="ai-generation-panel">
              <div className="ai-generation-top"><span>{generationMessage}</span><strong>{generationProgress}%</strong></div>
              <div className="ai-progress"><div className="ai-progress-fill" style={{ width: `${generationProgress}%` }} /></div>
            </div>
          )}

          <div className="file-upload-section">
             <FileUpload 
               projectId={projectId} 
               onAttachFile={handleAttachFile} 
               attachedFileIds={attachedFiles.map(f => f.id)} 
             />
          </div>

          <button className="settings-button" onClick={() => setShowSettings(true)}>⚙ Project Settings</button>
        </aside>

        {activeMode === "code" && (
          <section className="builder-center">
            <div className="editor-toolbar">
              <div className="editor-tabs">
                {["html", "css", "js"].map(tab => (
                  <button key={tab} className={activeTab === tab ? "editor-tab active" : "editor-tab"} onClick={() => setActiveTab(tab)}>
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="editor-body">
              <textarea
                className="premium-code-editor"
                value={activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode}
                onChange={(e) => handleManualCodeChange(activeTab, e.target.value)}
                spellCheck="false"
              />
            </div>
          </section>
        )}

        {activeMode === "preview" && (
          <section className="builder-right">
            <div className="preview-toolbar">
              <div className="device-controls">
                {["desktop", "tablet", "mobile"].map(d => (
                  <button key={d} className={device === d ? "device-btn active" : "device-btn"} onClick={() => setDevice(d)}>
                    {d === "desktop" ? "▣" : "▯"}
                  </button>
                ))}
              </div>
              <button onClick={() => setPreviewKey(k => k + 1)}>↻</button>
            </div>
            <div className="preview-area">
              <div className={`preview-device ${device}`}>
                <iframe key={previewKey} srcDoc={previewDocument} sandbox="allow-scripts allow-forms" />
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Builder;