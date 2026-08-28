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
import GitHubConnect from "../components/GitHubConnect";

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

  const [generationMode, setGenerationMode] =
    useState("generate");

  const abortController = useRef(null);

  /* ========================================================
     IMAGE / PROJECT FILES
  ======================================================== */

  const [projectImages, setProjectImages] =
    useState([]);

  const [loadingProjectImages, setLoadingProjectImages] =
    useState(false);

  const [selectedAIImage, setSelectedAIImage] =
    useState(null);

  /* ========================================================
     SAVE
  ======================================================== */

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);

  const autoSaveTimer = useRef(null);
  const historyTimer = useRef(null);

  const latestCodeRef = useRef({
    html: "",
    css: "",
    js: "",
  });

  const isLoadedRef = useRef(false);

  /* ========================================================
     HISTORY
  ======================================================== */

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] =
    useState(-1);

  /* ========================================================
     OTHER UI
  ======================================================== */

  const [showSettings, setShowSettings] =
    useState(false);

  const [showExport, setShowExport] =
    useState(false);

  /* ========================================================
     LOAD PROJECT
  ======================================================== */

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

        const {
          data,
          error,
        } = await supabase
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
          html: data.html_code || "",
          css: data.css_code || "",
          js: data.js_code || "",
        };

        setHistory([
          initialState,
        ]);

        setHistoryIndex(0);

        latestCodeRef.current =
          initialState;

        isLoadedRef.current = true;

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

  /* ========================================================
     LOAD PROJECT IMAGES
  ======================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadProjectImages() {
      if (!projectId) {
        return;
      }

      try {
        setLoadingProjectImages(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          return;
        }

        const {
          data: files,
          error: filesError,
        } = await supabase
          .from("project_files")
          .select(
            "id, file_name, file_path, file_type, file_size"
          )
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .order("created_at", {
            ascending: false,
          });

        if (filesError) {
          throw filesError;
        }

        const imageFiles = (
          files || []
        ).filter((file) => {
          const type =
            file.file_type || "";

          const extension =
            file.file_name
              ?.split(".")
              .pop()
              ?.toLowerCase();

          return (
            type.startsWith("image/") ||
            [
              "png",
              "jpg",
              "jpeg",
              "webp",
              "gif",
              "svg",
            ].includes(extension)
          );
        });

        const imagesWithUrls =
          await Promise.all(
            imageFiles.map(
              async (file) => {
                try {
                  const {
                    data,
                    error,
                  } =
                    await supabase.storage
                      .from("uploads")
                      .createSignedUrl(
                        file.file_path,
                        60 * 60
                      );

                  if (error) {
                    console.error(
                      "Image signed URL error:",
                      error
                    );

                    return null;
                  }

                  if (
                    !data?.signedUrl
                  ) {
                    return null;
                  }

                  return {
                    id: file.id,
                    fileName:
                      file.file_name,
                    filePath:
                      file.file_path,
                    fileType:
                      file.file_type ||
                      "image/*",
                    fileSize:
                      file.file_size ||
                      0,
                    url:
                      data.signedUrl,
                  };
                } catch (error) {
                  console.error(
                    "Image URL creation error:",
                    error
                  );

                  return null;
                }
              }
            )
          );

        if (!mounted) return;

        setProjectImages(
          imagesWithUrls.filter(
            Boolean
          )
        );
      } catch (error) {
        console.error(
          "Project image loading error:",
          error
        );

        if (mounted) {
          setProjectImages([]);
        }
      } finally {
        if (mounted) {
          setLoadingProjectImages(false);
        }
      }
    }

    loadProjectImages();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  /* ========================================================
     CURRENT CODE
  ======================================================== */

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

  /* ========================================================
     IMAGE CONTEXT
  ======================================================== */

  const imageContext = useMemo(
    () => {
      const images = projectImages.map(
        (image) => ({
          id: image.id,
          fileName:
            image.fileName,
          fileType:
            image.fileType,
          url: image.url,
        })
      );

      if (!selectedAIImage?.url) {
        return images;
      }

      const selected = {
        id: selectedAIImage.id,
        fileName:
          selectedAIImage.name ||
          selectedAIImage.fileName ||
          "reference-image",
        fileType:
          selectedAIImage.type ||
          selectedAIImage.fileType ||
          "image/*",
        url: selectedAIImage.url,
      };

      return [
        selected,
        ...images.filter(
          (image) =>
            image.id !== selected.id
        ),
      ];
    },
    [projectImages, selectedAIImage]
  );

  async function syncProjectImages(
    nextFiles = []
  ) {
    const imageFiles = (
      Array.isArray(nextFiles)
        ? nextFiles
        : []
    ).filter((file) => {
      const type = file?.file_type || "";
      const extension =
        file?.file_name
          ?.split(".")
          .pop()
          ?.toLowerCase();

      return (
        type.startsWith("image/") ||
        [
          "png",
          "jpg",
          "jpeg",
          "webp",
          "gif",
          "svg",
        ].includes(extension)
      );
    });

    const imagesWithUrls =
      await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const {
              data,
              error,
            } = await supabase.storage
              .from("uploads")
              .createSignedUrl(
                file.file_path,
                60 * 60
              );

            if (error || !data?.signedUrl) {
              return null;
            }

            return {
              id: file.id,
              fileName: file.file_name,
              filePath: file.file_path,
              fileType:
                file.file_type || "image/*",
              fileSize: file.file_size || 0,
              url: data.signedUrl,
            };
          } catch (error) {
            console.error(
              "Project image sync error:",
              error
            );
            return null;
          }
        })
      );

    setProjectImages(
      imagesWithUrls.filter(Boolean)
    );

    if (
      selectedAIImage?.id &&
      !imageFiles.some(
        (file) =>
          file.id === selectedAIImage.id
      )
    ) {
      setSelectedAIImage(null);
    }
  }

  function handleImageSelect(image) {
    if (!image?.url) return;

    setSelectedAIImage(image);

    setProjectImages((previous) => {
      const nextImage = {
        id: image.id,
        fileName:
          image.name ||
          image.fileName ||
          "reference-image",
        filePath:
          image.path ||
          image.filePath ||
          "",
        fileType:
          image.type ||
          image.fileType ||
          "image/*",
        fileSize: image.fileSize || 0,
        url: image.url,
      };

      const withoutCurrent =
        previous.filter(
          (item) => item.id !== nextImage.id
        );

      return [nextImage, ...withoutCurrent];
    });
  }

  /* ========================================================
     LIVE CODE REF
  ======================================================== */

  useEffect(() => {
    latestCodeRef.current =
      currentCode;
  }, [currentCode]);

  /* ========================================================
     HISTORY
  ======================================================== */

  function pushHistory(nextState) {
    setHistory((previous) => {
      const currentIndex =
        Math.max(
          0,
          Math.min(
            historyIndex,
            previous.length - 1
          )
        );

      const current =
        previous[currentIndex];

      if (
        current &&
        current.html ===
          nextState.html &&
        current.css ===
          nextState.css &&
        current.js ===
          nextState.js
      ) {
        return previous;
      }

      const trimmed =
        previous.slice(
          0,
          currentIndex + 1
        );

      const nextHistory = [
        ...trimmed,
        nextState,
      ].slice(-30);

      setHistoryIndex(
        nextHistory.length - 1
      );

      return nextHistory;
    });
  }

  function markChanged() {
    setSaved(false);
  }

  function handleManualCodeChange(
    type,
    value
  ) {
    const nextState = {
      ...latestCodeRef.current,
      [type]: value,
    };

    latestCodeRef.current =
      nextState;

    if (type === "html") {
      setHtmlCode(value);
    }

    if (type === "css") {
      setCssCode(value);
    }

    if (type === "js") {
      setJsCode(value);
    }

    setSaved(false);

    if (historyTimer.current) {
      clearTimeout(
        historyTimer.current
      );
    }

    historyTimer.current =
      setTimeout(() => {
        pushHistory({
          ...latestCodeRef.current,
        });

        historyTimer.current =
          null;
      }, 450);
  }

  /* ========================================================
     AUTO SAVE
  ======================================================== */

  async function saveProjectData({
    silent = false,
  } = {}) {
    if (
      !projectId ||
      !isLoadedRef.current
    ) {
      return false;
    }

    if (!silent) {
      setSaving(true);
    } else {
      setAutoSaving(true);
    }

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
      } = await supabase
        .from("projects")
        .update({
          prompt,

          html_code:
            latestCodeRef.current
              .html,

          css_code:
            latestCodeRef.current
              .css,

          js_code:
            latestCodeRef.current
              .js,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setSaved(true);

      return true;
    } catch (error) {
      console.error(
        "Save error:",
        error
      );

      if (!silent) {
        alert(
          error?.message ||
            "Save failed."
        );
      }

      return false;
    } finally {
      if (!silent) {
        setSaving(false);
      } else {
        setAutoSaving(false);
      }
    }
  }

  useEffect(() => {
    if (
      !projectId ||
      !isLoadedRef.current ||
      saved ||
      generating
    ) {
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(
        autoSaveTimer.current
      );
    }

    autoSaveTimer.current =
      setTimeout(() => {
        saveProjectData({
          silent: true,
        });

        autoSaveTimer.current =
          null;
      }, 1800);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(
          autoSaveTimer.current
        );
      }
    };
  }, [
    prompt,
    htmlCode,
    cssCode,
    jsCode,
    saved,
    generating,
    projectId,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(
          autoSaveTimer.current
        );
      }

      if (historyTimer.current) {
        clearTimeout(
          historyTimer.current
        );
      }

      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  /* ========================================================
     UNDO
  ======================================================== */

  function handleUndo() {
    if (historyTimer.current) {
      clearTimeout(
        historyTimer.current
      );

      historyTimer.current = null;
    }

    if (historyIndex <= 0) {
      return;
    }

    const previous =
      history[historyIndex - 1];

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

    latestCodeRef.current =
      previous;

    setHistoryIndex(
      historyIndex - 1
    );

    setSaved(false);

    setPreviewKey(
      (value) => value + 1
    );
  }

  /* ========================================================
     REDO
  ======================================================== */

  function handleRedo() {
    if (historyTimer.current) {
      clearTimeout(
        historyTimer.current
      );

      historyTimer.current = null;
    }

    if (
      historyIndex >=
      history.length - 1
    ) {
      return;
    }

    const next =
      history[historyIndex + 1];

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

    latestCodeRef.current =
      next;

    setHistoryIndex(
      historyIndex + 1
    );

    setSaved(false);

    setPreviewKey(
      (value) => value + 1
    );
  }

  /* ========================================================
     SAVE
  ======================================================== */

  async function handleSave() {
    if (autoSaveTimer.current) {
      clearTimeout(
        autoSaveTimer.current
      );

      autoSaveTimer.current =
        null;
    }

    await saveProjectData({
      silent: false,
    });
  }

  /* ========================================================
     SSE PARSER
  ======================================================== */

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

      let eventName = "message";
      let data = "";

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
          data += line
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

  /* ========================================================
     GENERATE WITH GEMINI
  ======================================================== */

  async function handleGenerate(
    mode = "generate"
  ) {
    if (generating) {
      return;
    }

    if (!prompt.trim()) {
      alert(
        "Please describe what you want to build."
      );

      return;
    }

    if (
      mode === "edit" &&
      !htmlCode.trim() &&
      !cssCode.trim() &&
      !jsCode.trim()
    ) {
      alert(
        "There is no existing website to edit yet. Generate a website first."
      );

      return;
    }

    setGenerating(true);

    setGenerationMode(
      mode
    );

    setGenerationError("");

    setGenerationStage(
      "thinking"
    );

    setGenerationMessage(
      mode === "edit"
        ? "Understanding your existing website..."
        : "Understanding your idea..."
    );

    setGenerationModel("");

    setGenerationProgress(3);

    setActiveMode("code");

    if (historyTimer.current) {
      clearTimeout(
        historyTimer.current
      );

      historyTimer.current =
        null;
    }

    if (mode === "generate") {
      setHtmlCode("");
      setCssCode("");
      setJsCode("");

      latestCodeRef.current = {
        html: "",
        css: "",
        js: "",
      };
    }

    abortController.current =
      new AbortController();

    try {
      /*
       * IMPORTANT:
       * Project images are now included in the
       * request sent to the AI API.
       *
       * The next server-side step will make
       * Gemini actually read these image URLs.
       */

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
              mode,
              currentCode,
              projectId,

              images:
                imageContext,
            }),

            signal:
              abortController
                .current.signal,
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

      while (true) {
        const {
          value,
          done,
        } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(
          value,
          {
            stream: true,
          }
        );

        buffer =
          parseSSEChunk(
            buffer,
            (event, data) => {
              /* STATUS */

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

                if (data.model) {
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

              /* CODE */

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

                  latestCodeRef.current =
                    {
                      ...latestCodeRef.current,
                      html:
                        streamedHTML,
                    };

                  setHtmlCode(
                    streamedHTML
                  );

                  setGenerationProgress(
                    Math.min(
                      60,
                      15 +
                        Math.floor(
                          streamedHTML
                            .length /
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

                  latestCodeRef.current =
                    {
                      ...latestCodeRef.current,
                      css:
                        streamedCSS,
                    };

                  setCssCode(
                    streamedCSS
                  );

                  setGenerationProgress(
                    Math.min(
                      85,
                      55 +
                        Math.floor(
                          streamedCSS
                            .length /
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

                  latestCodeRef.current =
                    {
                      ...latestCodeRef.current,
                      js:
                        streamedJS,
                    };

                  setJsCode(
                    streamedJS
                  );

                  setGenerationProgress(
                    Math.min(
                      98,
                      80 +
                        Math.floor(
                          streamedJS
                            .length /
                            300
                        )
                    )
                  );
                }

                setSaved(false);
              }

              /* COMPLETE */

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

                latestCodeRef.current =
                  {
                    html:
                      finalHTML,
                    css:
                      finalCSS,
                    js:
                      finalJS,
                  };

                setGenerationProgress(
                  100
                );

                setGenerationStage(
                  "complete"
                );

                setGenerationMessage(
                  mode === "edit"
                    ? "Website updated successfully."
                    : "Website generated successfully."
                );

                if (data.model) {
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

              /* ERROR */

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

      /* FALLBACK */

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

        latestCodeRef.current =
          {
            html:
              streamedHTML,
            css:
              streamedCSS,
            js:
              streamedJS,
          };

        setGenerationStage(
          "complete"
        );

        setGenerationProgress(
          100
        );

        setGenerationMessage(
          mode === "edit"
            ? "Website update finished."
            : "Generation finished."
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

  /* ========================================================
     CANCEL GENERATION
  ======================================================== */

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

  /* ========================================================
     PREVIEW DOCUMENT
  ======================================================== */

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

  /* ========================================================
     DOWNLOAD ZIP
  ======================================================== */

  async function handleDownloadZip() {
    if (!project) return;

    try {
      const zip =
        new JSZip();

      const html = `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
${project.name || "My Website"}
</title>

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
`;

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
        await zip.generateAsync(
          {
            type: "blob",
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
        }.zip`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
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

  /* ========================================================
     EXPORT CODE
  ======================================================== */

  function handleExportCode() {
    if (!project) return;

    const content = `
===== index.html =====

<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
${project.name || "My Website"}
</title>

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

    setTimeout(() => {
      URL.revokeObjectURL(
        url
      );
    }, 1000);
  }

  /* ========================================================
     LOADING
  ======================================================== */

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

  /* ========================================================
     PROJECT ERROR
  ======================================================== */

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

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div
      className={`builder-page ${
        fullscreen
          ? "builder-fullscreen"
          : ""
      }`}
    >

      {/* ==================================================
          TOP BAR
      ================================================== */}

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
            {autoSaving
              ? "Auto-saving..."
              : saved
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

      {/* ==================================================
          EXPORT MENU
      ================================================== */}

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

<GitHubConnect />
          <button>
            ▲ Vercel

            <small>
              Coming soon
            </small>
          </button>

        </div>
      )}

      {/* ==================================================
          WORKSPACE
      ================================================== */}

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

          <div
            className={`ai-status ${
              generating
                ? "generating"
                : ""
            }`}
          >

            <span className="status-dot" />

            {generating
              ? generationMode ===
                "edit"
                ? "Gemini Editing..."
                : "Gemini Generating..."
              : "Gemini Ready"}

          </div>

          {/* ==================================================
              IMAGE STATUS
          ================================================== */}

          <div className="project-image-ai-status">

            <span>
              🖼️
            </span>

            <div>

              <strong>
                AI Images
              </strong>

              <small>
                {loadingProjectImages
                  ? "Loading images..."
                  : projectImages.length >
                    0
                  ? `${projectImages.length} image${
                      projectImages.length >
                      1
                        ? "s"
                        : ""
                    } connected`
                  : "No images uploaded"}

              </small>

            </div>

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
            placeholder={
              generationMode ===
              "edit"
                ? "Describe the changes you want AI to make..."
                : "Describe what you want to build..."
            }
            disabled={
              generating
            }
          />

          {!generating ? (
            <>
              <button
                className="generate-button"
                onClick={() =>
                  handleGenerate(
                    "generate"
                  )
                }
              >
                <span>
                  ✦
                </span>

                Generate Website
              </button>

              <button
                className="generate-button ai-edit-button"
                onClick={() =>
                  handleGenerate(
                    "edit"
                  )
                }
                disabled={
                  !htmlCode.trim() &&
                  !cssCode.trim() &&
                  !jsCode.trim()
                }
                title="Edit the existing website with AI"
              >
                <span>
                  ✎
                </span>

                Edit Existing Website
              </button>
            </>
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
                  {
                    generationProgress
                  }%
                </strong>

              </div>

              <div className="ai-progress">

                <div
                  className="ai-progress-fill"
                  style={{
                    width: `${generationProgress}%`,
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
                onClick={() =>
                  handleGenerate(
                    generationMode
                  )
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

          {/* ==================================================
              PROJECT FILES
          ================================================== */}

          <div className="file-upload-section">

            <div className="file-upload-title">

              <span>
                📁
              </span>

              <div>

                <strong>
                  Project Files
                </strong>

                <small>
                  Upload images & files
                </small>

              </div>

            </div>

            <FileUpload
              projectId={
                projectId
              }
              onImageSelect={
                handleImageSelect
              }
              onFilesChange={
                syncProjectImages
              }
            />

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
                    length: (
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
                  onChange={(event) =>
                    handleManualCodeChange(
                      "html",
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
                    handleManualCodeChange(
                      "css",
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
                    handleManualCodeChange(
                      "js",
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
                {generating
                  ? "● Gemini live generation"
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

      {/* ==================================================
          SETTINGS
      ================================================== */}

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

            <div className="setting-row">

              <div>

                <strong>
                  Connected Images
                </strong>

                <p>
                  {loadingProjectImages
                    ? "Loading..."
                    : `${projectImages.length} image${
                        projectImages.length !==
                        1
                          ? "s"
                          : ""
                      } connected to AI`}
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