import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function FileUpload({ projectId }) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingFile, setProcessingFile] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
  ];

  /* ========================================================
     INITIALIZE
  ======================================================== */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        setError("");

        if (!projectId) {
          setError("Project ID is missing.");
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!mounted) return;

        if (!user) {
          setError("You are not logged in.");
          return;
        }

        setUser(user);

        await loadFiles(user.id, projectId);
      } catch (err) {
        console.error(
          "File system initialization error:",
          err
        );

        if (mounted) {
          setError(
            err?.message ||
              "Failed to initialize project files."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  /* ========================================================
     PATH HELPERS
  ======================================================== */

  function getProjectFolder(userId = user?.id) {
    if (!userId || !projectId) {
      return "";
    }

    return `${userId}/${projectId}`;
  }

  function getFilePath(
    fileName,
    userId = user?.id
  ) {
    const folder = getProjectFolder(userId);

    if (!folder || !fileName) {
      return "";
    }

    return `${folder}/${fileName}`;
  }

  /* ========================================================
     LOAD FILES
  ======================================================== */

  async function loadFiles(
    userId,
    currentProjectId
  ) {
    try {
      setError("");

      if (!userId || !currentProjectId) {
        return;
      }

      const folder =
        `${userId}/${currentProjectId}`;

      const {
        data,
        error: listError,
      } = await supabase.storage
        .from("uploads")
        .list(folder, {
          limit: 100,
          sortBy: {
            column: "created_at",
            order: "desc",
          },
        });

      if (listError) {
        throw listError;
      }

      setFiles(
        (data || []).filter(
          (file) => file.name
        )
      );
    } catch (err) {
      console.error(
        "Load files error:",
        err
      );

      setError(
        err?.message ||
          "Failed to load files."
      );
    }
  }

  /* ========================================================
     SELECT FILE
  ======================================================== */

  function handleFileSelect(event) {
    const file =
      event.target.files?.[0];

    setMessage("");
    setError("");

    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);

      setError(
        "File is too large. Maximum size is 10 MB."
      );

      event.target.value = "";
      return;
    }

    if (
      !ALLOWED_TYPES.includes(file.type)
    ) {
      setSelectedFile(null);

      setError(
        "This file type is not supported."
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  /* ========================================================
     START NORMAL UPLOAD
  ======================================================== */

  function openUploadPicker() {
    setReplaceTarget(null);
    setSelectedFile(null);
    setMessage("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  /* ========================================================
     START REPLACE
  ======================================================== */

  function openReplacePicker(file) {
    setReplaceTarget(file);
    setSelectedFile(null);
    setMessage("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  /* ========================================================
     UPLOAD / REPLACE
  ======================================================== */

  async function handleUpload() {
    if (!selectedFile) {
      setError(
        "Please choose a file first."
      );
      return;
    }

    if (!user) {
      setError(
        "You are not logged in."
      );
      return;
    }

    if (!projectId) {
      setError(
        "Project ID is missing."
      );
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      /*
       * =====================================================
       * REPLACE EXISTING FILE
       * =====================================================
       */

      if (replaceTarget) {
        await handleReplaceFile();
        return;
      }

      /*
       * =====================================================
       * NORMAL UPLOAD
       * =====================================================
       */

      const safeName =
        selectedFile.name
          .trim()
          .replace(/\s+/g, "-")
          .replace(
            /[^a-zA-Z0-9._-]/g,
            ""
          );

      const finalName =
        safeName ||
        `file-${Date.now()}`;

      const uniqueName =
        `${crypto.randomUUID()}-${finalName}`;

      const filePath =
        getFilePath(
          uniqueName,
          user.id
        );

      if (!filePath) {
        throw new Error(
          "Could not create file path."
        );
      }

      const {
        error: uploadError,
      } = await supabase.storage
        .from("uploads")
        .upload(
          filePath,
          selectedFile,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              selectedFile.type ||
              "application/octet-stream",
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      setMessage(
        `"${selectedFile.name}" uploaded successfully.`
      );

      resetFileInput();

      await loadFiles(
        user.id,
        projectId
      );
    } catch (err) {
      console.error(
        "Upload error:",
        err
      );

      setError(
        err?.message ||
          "File upload failed."
      );
    } finally {
      setUploading(false);
      setReplaceTarget(null);
    }
  }

  /* ========================================================
     REPLACE FILE
  ======================================================== */

  async function handleReplaceFile() {
    if (
      !replaceTarget ||
      !selectedFile
    ) {
      return;
    }

    const oldPath =
      getFilePath(
        replaceTarget.name,
        user.id
      );

    const safeName =
      selectedFile.name
        .trim()
        .replace(/\s+/g, "-")
        .replace(
          /[^a-zA-Z0-9._-]/g,
          ""
        );

    const finalName =
      safeName ||
      `file-${Date.now()}`;

    const newFileName =
      `${crypto.randomUUID()}-${finalName}`;

    const newPath =
      getFilePath(
        newFileName,
        user.id
      );

    /*
     * Upload new version first.
     * If upload succeeds, remove old file.
     */

    const {
      error: uploadError,
    } = await supabase.storage
      .from("uploads")
      .upload(
        newPath,
        selectedFile,
        {
          cacheControl: "3600",
          upsert: false,
          contentType:
            selectedFile.type ||
            "application/octet-stream",
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    /*
     * Delete old version.
     */

    const {
      error: deleteError,
    } = await supabase.storage
      .from("uploads")
      .remove([oldPath]);

    if (deleteError) {
      /*
       * New file already exists.
       * We intentionally don't delete it here,
       * so the user's replacement isn't lost.
       */

      console.error(
        "Old file delete failed:",
        deleteError
      );

      setMessage(
        "Replacement uploaded, but the old file could not be removed."
      );
    } else {
      setMessage(
        `"${selectedFile.name}" replaced successfully.`
      );
    }

    resetFileInput();

    await loadFiles(
      user.id,
      projectId
    );
  }

  /* ========================================================
     RESET INPUT
  ======================================================== */

  function resetFileInput() {
    setSelectedFile(null);
    setReplaceTarget(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  /* ========================================================
     DOWNLOAD
  ======================================================== */

  async function handleDownload(
    fileName
  ) {
    if (!user || !projectId) {
      return;
    }

    setProcessingFile(fileName);
    setError("");

    try {
      const filePath =
        getFilePath(
          fileName,
          user.id
        );

      const {
        data,
        error: downloadError,
      } =
        await supabase.storage
          .from("uploads")
          .download(filePath);

      if (downloadError) {
        throw downloadError;
      }

      const url =
        URL.createObjectURL(data);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        getOriginalFileName(
          fileName
        );

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error(
        "Download error:",
        err
      );

      setError(
        err?.message ||
          "Download failed."
      );
    } finally {
      setProcessingFile("");
    }
  }

  /* ========================================================
     DELETE
  ======================================================== */

  async function handleDelete(
    fileName
  ) {
    if (!user || !projectId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${getOriginalFileName(
          fileName
        )}"?`
      );

    if (!confirmed) {
      return;
    }

    setProcessingFile(fileName);
    setError("");
    setMessage("");

    try {
      const filePath =
        getFilePath(
          fileName,
          user.id
        );

      const {
        error: deleteError,
      } =
        await supabase.storage
          .from("uploads")
          .remove([
            filePath,
          ]);

      if (deleteError) {
        throw deleteError;
      }

      setMessage(
        "File deleted successfully."
      );

      await loadFiles(
        user.id,
        projectId
      );
    } catch (err) {
      console.error(
        "Delete error:",
        err
      );

      setError(
        err?.message ||
          "Delete failed."
      );
    } finally {
      setProcessingFile("");
    }
  }

  /* ========================================================
     PREVIEW
  ======================================================== */

  async function handlePreview(
    fileName
  ) {
    if (!user || !projectId) {
      return;
    }

    setProcessingFile(fileName);
    setError("");

    try {
      const filePath =
        getFilePath(
          fileName,
          user.id
        );

      const {
        data,
        error: signedUrlError,
      } =
        await supabase.storage
          .from("uploads")
          .createSignedUrl(
            filePath,
            60 * 60
          );

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Could not create preview URL."
        );
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error(
        "Preview error:",
        err
      );

      setError(
        err?.message ||
          "Preview failed."
      );
    } finally {
      setProcessingFile("");
    }
  }

  /* ========================================================
     AI ASSET FOUNDATION
  ======================================================== */

  async function getAIFileReference(
    fileName
  ) {
    if (!user || !projectId) {
      return null;
    }

    try {
      const filePath =
        getFilePath(
          fileName,
          user.id
        );

      const {
        data,
        error: signedUrlError,
      } =
        await supabase.storage
          .from("uploads")
          .createSignedUrl(
            filePath,
            60 * 60
          );

      if (signedUrlError) {
        throw signedUrlError;
      }

      return {
        projectId,
        userId: user.id,
        bucket: "uploads",
        storagePath: filePath,
        fileName,
        url: data?.signedUrl || null,
        type: getFileType(fileName),
      };
    } catch (err) {
      console.error(
        "AI file reference error:",
        err
      );

      return null;
    }
  }

  /*
   * This function will later allow Builder/AI
   * to request a project asset.
   *
   * Example:
   *
   * const asset =
   *   await getAIFileReference(
   *     file.name
   *   );
   */

  /* ========================================================
     HELPERS
  ======================================================== */

  function getOriginalFileName(
    name
  ) {
    if (!name) {
      return "";
    }

    /*
     * Current upload format:
     *
     * UUID-original-name.ext
     */

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i;

    const match =
      name.match(uuidPattern);

    if (match?.[1]) {
      return match[1];
    }

    return name;
  }

  function getFileType(name) {
    const extension =
      name
        ?.split(".")
        .pop()
        ?.toLowerCase();

    if (
      [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "svg",
      ].includes(extension)
    ) {
      return "image";
    }

    if (extension === "pdf") {
      return "pdf";
    }

    if (
      [
        "zip",
        "rar",
        "7z",
      ].includes(extension)
    ) {
      return "archive";
    }

    if (
      [
        "txt",
      ].includes(extension)
    ) {
      return "text";
    }

    return "file";
  }

  function getFileIcon(name) {
    const type =
      getFileType(name);

    if (type === "image") {
      return "🖼️";
    }

    if (type === "pdf") {
      return "📕";
    }

    if (type === "archive") {
      return "📦";
    }

    if (type === "text") {
      return "📝";
    }

    return "📄";
  }

  function formatSize(bytes) {
    if (!bytes) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index =
      Math.min(
        Math.floor(
          Math.log(bytes) /
            Math.log(1024)
        ),
        units.length - 1
      );

    return `${(
      bytes /
      Math.pow(1024, index)
    ).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  }

  function isPreviewable(
    fileName
  ) {
    return [
      "image",
      "pdf",
    ].includes(
      getFileType(fileName)
    );
  }

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="project-file-manager">

      {/* FILE PICKER */}

      <input
        ref={fileInputRef}
        id="project-file-input"
        type="file"
        onChange={
          handleFileSelect
        }
        disabled={uploading}
      />

      {/* SELECTED FILE */}

      {selectedFile && (
        <div className="selected-file-box">

          <span>
            {getFileIcon(
              selectedFile.name
            )}
          </span>

          <div>
            <strong>
              {selectedFile.name}
            </strong>

            <small>
              {formatSize(
                selectedFile.size
              )}
            </small>
          </div>

        </div>
      )}

      {/* REPLACE TARGET */}

      {replaceTarget && (
        <div className="replace-file-box">

          <span>↻</span>

          <div>
            <strong>
              Replacing file
            </strong>

            <small>
              {getOriginalFileName(
                replaceTarget.name
              )}
            </small>
          </div>

        </div>
      )}

      {/* UPLOAD BUTTON */}

      <button
        onClick={
          selectedFile
            ? handleUpload
            : openUploadPicker
        }
        disabled={uploading}
      >
        {uploading
          ? replaceTarget
            ? "Replacing..."
            : "Uploading..."
          : selectedFile
          ? replaceTarget
            ? "↻ Replace File"
            : "⬆ Upload File"
          : "📤 Choose File"}
      </button>

      {/* CANCEL REPLACE */}

      {replaceTarget && !uploading && (
        <button
          type="button"
          onClick={
            resetFileInput
          }
        >
          Cancel
        </button>
      )}

      {/* MESSAGE */}

      {message && (
        <p className="file-success">
          ✓ {message}
        </p>
      )}

      {/* ERROR */}

      {error && (
        <p className="file-error">
          ⚠ {error}
        </p>
      )}

      {/* FILE LIST */}

      <div className="uploaded-files">

        <div className="uploaded-files-header">

          <strong>
            Your Project Files
          </strong>

          <span>
            {files.length}
          </span>

        </div>

        {loading ? (
          <div className="files-loading">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="empty-files">

            <span>
              📂
            </span>

            <p>
              No files uploaded yet.
            </p>

            <small>
              Upload images and files
              for this project.
            </small>

          </div>
        ) : (
          <div className="files-list">

            {files.map((file) => {
              const busy =
                processingFile ===
                file.name;

              return (
                <div
                  className="uploaded-file-item"
                  key={
                    file.id ||
                    file.name
                  }
                >

                  {/* FILE INFO */}

                  <div className="file-info">

                    <div className="file-icon">
                      {getFileIcon(
                        file.name
                      )}
                    </div>

                    <div className="file-details">

                      <strong
                        title={
                          getOriginalFileName(
                            file.name
                          )
                        }
                      >
                        {getOriginalFileName(
                          file.name
                        )}
                      </strong>

                      <small>
                        {formatSize(
                          file.metadata
                            ?.size ||
                            0
                        )}
                      </small>

                    </div>

                  </div>

                  {/* ACTIONS */}

                  <div className="file-actions">

                    {isPreviewable(
                      file.name
                    ) && (
                      <button
                        onClick={() =>
                          handlePreview(
                            file.name
                          )
                        }
                        disabled={busy}
                        title="Preview"
                      >
                        👁
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleDownload(
                          file.name
                        )
                      }
                      disabled={busy}
                      title="Download"
                    >
                      ↓
                    </button>

                    <button
                      onClick={() =>
                        openReplacePicker(
                          file
                        )
                      }
                      disabled={busy}
                      title="Replace / Update"
                    >
                      ↻
                    </button>

                    <button
                      className="delete-file-btn"
                      onClick={() =>
                        handleDelete(
                          file.name
                        )
                      }
                      disabled={busy}
                      title="Delete"
                    >
                      🗑
                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>

    </div>
  );
}

export default FileUpload;