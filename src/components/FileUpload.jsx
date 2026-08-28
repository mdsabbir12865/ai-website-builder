import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function FileUpload({ projectId, onImageSelect, onFilesChange }) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectingImage, setSelectingImage] = useState(null);

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
          setLoading(false);
          return;
        }

        setUser(user);

        if (!projectId) {
          setError("Project ID is missing.");
          setLoading(false);
          return;
        }

        await loadFiles(user.id, projectId);
      } catch (err) {
        console.error("File initialization error:", err);

        if (mounted) {
          setError(
            err?.message ||
              "Failed to initialize file manager."
          );
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
     LOAD FILES FROM DATABASE
  ======================================================== */

  async function loadFiles(userId, currentProjectId) {
    try {
      setError("");

      const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("user_id", userId)
        .eq("project_id", currentProjectId)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const nextFiles = data || [];

      setFiles(nextFiles);

      if (typeof onFilesChange === "function") {
        onFilesChange(nextFiles);
      }
    } catch (err) {
      console.error("Load files error:", err);

      setError(
        err?.message ||
          "Failed to load project files."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ========================================================
     SELECT FILE
  ======================================================== */

  function handleFileSelect(event) {
    const file = event.target.files?.[0];

    setMessage("");
    setError("");
    setSelectedFile(null);
    setReplaceTarget(null);

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "File is too large. Maximum size is 10 MB."
      );

      event.target.value = "";
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        "This file type is not supported."
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  /* ========================================================
     START REPLACE
  ======================================================== */

  function handleStartReplace(file) {
    setMessage("");
    setError("");
    setReplaceTarget(file);

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  /* ========================================================
     REPLACE FILE SELECT
  ======================================================== */

  function handleReplaceFileSelect(event) {
    const file = event.target.files?.[0];

    setMessage("");
    setError("");

    if (!file) {
      setReplaceTarget(null);
      return;
    }

    if (!replaceTarget) {
      setError("Replace target is missing.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        "File is too large. Maximum size is 10 MB."
      );

      event.target.value = "";
      setReplaceTarget(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        "This file type is not supported."
      );

      event.target.value = "";
      setReplaceTarget(null);
      return;
    }

    replaceFile(
      replaceTarget,
      file
    );
  }

  /* ========================================================
     UPLOAD NEW FILE
  ======================================================== */

  async function handleUpload() {
    if (!selectedFile) {
      setError("Please choose a file first.");
      return;
    }

    if (!user) {
      setError("You are not logged in.");
      return;
    }

    if (!projectId) {
      setError("Project ID is missing.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const safeName = selectedFile.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const uniqueName =
        `${crypto.randomUUID()}-${safeName}`;

      const filePath =
        `${user.id}/${projectId}/${uniqueName}`;

      /* ---------------------------------------------
         1. Upload actual file to Storage
      --------------------------------------------- */

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

      /* ---------------------------------------------
         2. Save metadata to project_files
      --------------------------------------------- */

      const {
        error: databaseError,
      } = await supabase
        .from("project_files")
        .insert({
          user_id: user.id,
          project_id: projectId,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type:
            selectedFile.type ||
            "application/octet-stream",
          file_size: selectedFile.size,
        });

      /* ---------------------------------------------
         Rollback Storage if DB insert fails
      --------------------------------------------- */

      if (databaseError) {
        await supabase.storage
          .from("uploads")
          .remove([filePath]);

        throw databaseError;
      }

      setMessage(
        `"${selectedFile.name}" uploaded successfully.`
      );

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

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
    }
  }

  /* ========================================================
     REPLACE FILE
  ======================================================== */

  async function replaceFile(
    oldFile,
    newFile
  ) {
    if (!user || !projectId) {
      setError(
        "User or project information is missing."
      );
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const safeName = newFile.name
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const newFileName =
        `${crypto.randomUUID()}-${safeName}`;

      const newFilePath =
        `${user.id}/${projectId}/${newFileName}`;

      /* ---------------------------------------------
         1. Upload replacement file
      --------------------------------------------- */

      const {
        error: uploadError,
      } = await supabase.storage
        .from("uploads")
        .upload(
          newFilePath,
          newFile,
          {
            cacheControl: "3600",
            upsert: false,
            contentType:
              newFile.type ||
              "application/octet-stream",
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      /* ---------------------------------------------
         2. Update database metadata
      --------------------------------------------- */

      const {
        error: databaseError,
      } = await supabase
        .from("project_files")
        .update({
          file_name: newFile.name,
          file_path: newFilePath,
          file_type:
            newFile.type ||
            "application/octet-stream",
          file_size: newFile.size,
        })
        .eq("id", oldFile.id)
        .eq("user_id", user.id)
        .eq("project_id", projectId);

      /* ---------------------------------------------
         Rollback new Storage file
      --------------------------------------------- */

      if (databaseError) {
        await supabase.storage
          .from("uploads")
          .remove([newFilePath]);

        throw databaseError;
      }

      /* ---------------------------------------------
         3. Delete old Storage file
      --------------------------------------------- */

      if (oldFile.file_path) {
        const {
          error: oldDeleteError,
        } = await supabase.storage
          .from("uploads")
          .remove([
            oldFile.file_path,
          ]);

        if (oldDeleteError) {
          console.warn(
            "Old file cleanup warning:",
            oldDeleteError
          );
        }
      }

      setMessage(
        `"${oldFile.file_name}" replaced successfully.`
      );

      setReplaceTarget(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadFiles(
        user.id,
        projectId
      );
    } catch (err) {
      console.error(
        "Replace error:",
        err
      );

      setError(
        err?.message ||
          "File replacement failed."
      );
    } finally {
      setUploading(false);
    }
  }

  /* ========================================================
     USE IMAGE FOR AI
  ======================================================== */

  async function handleUseImageForAI(file) {
    if (!user || !projectId) {
      setError(
        "User or project information is missing."
      );
      return;
    }

    if (!file?.file_path) {
      setError(
        "Image file path is missing."
      );
      return;
    }

    if (
      !file.file_type ||
      !file.file_type.startsWith("image/")
    ) {
      setError(
        "Only image files can be used as AI references."
      );
      return;
    }

    setSelectingImage(file.id);
    setMessage("");
    setError("");

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

      if (error) {
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Could not create image URL."
        );
      }

      /*
       * Send image information to Builder.
       *
       * Builder will later pass this information
       * to the AI generation API.
       */

      if (typeof onImageSelect === "function") {
        onImageSelect({
          id: file.id,
          name: file.file_name,
          type: file.file_type,
          url: data.signedUrl,
          path: file.file_path,
        });
      }

      setMessage(
        `"${file.file_name}" selected as AI reference image.`
      );
    } catch (err) {
      console.error(
        "AI image selection error:",
        err
      );

      setError(
        err?.message ||
          "Could not select image for AI."
      );
    } finally {
      setSelectingImage(null);
    }
  }

  /* ========================================================
     DOWNLOAD
  ======================================================== */

  async function handleDownload(file) {
    if (!user || !projectId) return;

    try {
      setError("");
      setMessage("");

      const {
        data,
        error,
      } = await supabase.storage
        .from("uploads")
        .download(file.file_path);

      if (error) {
        throw error;
      }

      const url =
        URL.createObjectURL(data);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        file.file_name;

      document.body.appendChild(link);

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
    }
  }

  /* ========================================================
     DELETE
  ======================================================== */

  async function handleDelete(file) {
    if (!user || !projectId) return;

    const confirmed =
      window.confirm(
        `Delete "${file.file_name}"?`
      );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      /* ---------------------------------------------
         1. Delete Storage file
      --------------------------------------------- */

      const {
        error: storageError,
      } = await supabase.storage
        .from("uploads")
        .remove([
          file.file_path,
        ]);

      if (storageError) {
        throw storageError;
      }

      /* ---------------------------------------------
         2. Delete database metadata
      --------------------------------------------- */

      const {
        error: databaseError,
      } = await supabase
        .from("project_files")
        .delete()
        .eq("id", file.id)
        .eq("user_id", user.id)
        .eq("project_id", projectId);

      if (databaseError) {
        throw databaseError;
      }

      setMessage(
        `"${file.file_name}" deleted successfully.`
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
    }
  }

  /* ========================================================
     PREVIEW
  ======================================================== */

  async function handlePreview(file) {
    if (!user || !projectId) return;

    try {
      setError("");
      setMessage("");

      const {
        data,
        error,
      } = await supabase.storage
        .from("uploads")
        .createSignedUrl(
          file.file_path,
          60 * 60
        );

      if (error) {
        throw error;
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
    }
  }

  /* ========================================================
     HELPERS
  ======================================================== */

  function getFileIcon(name) {
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
      return "🖼️";
    }

    if (extension === "pdf") {
      return "📕";
    }

    if (
      [
        "zip",
        "rar",
        "7z",
      ].includes(extension)
    ) {
      return "📦";
    }

    if (
      [
        "mp4",
        "webm",
        "mov",
        "avi",
      ].includes(extension)
    ) {
      return "🎬";
    }

    if (
      ["txt"].includes(extension)
    ) {
      return "📝";
    }

    return "📄";
  }

  function formatSize(bytes) {
    if (!bytes) return "0 B";

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.min(
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

  function isPreviewable(file) {
    const type =
      file.file_type || "";

    const extension =
      file.file_name
        ?.split(".")
        .pop()
        ?.toLowerCase();

    return (
      type.startsWith("image/") ||
      type === "application/pdf" ||
      [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "svg",
        "pdf",
      ].includes(extension)
    );
  }

  function isImage(file) {
    return (
      file?.file_type?.startsWith(
        "image/"
      ) ||
      [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "svg",
      ].includes(
        file?.file_name
          ?.split(".")
          .pop()
          ?.toLowerCase()
      )
    );
  }

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="project-file-manager">

      <style>{`
        .project-file-manager {
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .project-file-manager *,
        .project-file-manager *::before,
        .project-file-manager *::after {
          box-sizing: border-box;
        }

        .project-file-manager > input[type="file"] {
          display: block;
          width: 100%;
          max-width: 100%;
          margin: 0 0 12px;
          padding: 9px 10px;
          border: 1px dashed rgba(148, 163, 184, 0.45);
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.3;
          overflow: hidden;
        }

        .project-file-manager .selected-file-box {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-width: 0;
          margin: 10px 0;
          padding: 10px 12px;
          border-radius: 10px;
          overflow: hidden;
        }

        .project-file-manager .selected-file-box > div {
          min-width: 0;
          flex: 1 1 auto;
        }

        .project-file-manager .selected-file-box strong,
        .project-file-manager .selected-file-box small {
          display: block;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .project-file-manager .file-upload-primary-btn {
          width: 100%;
          min-height: 42px;
          margin: 4px 0 14px;
        }

        .project-file-manager .uploaded-files {
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .project-file-manager .uploaded-files-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          min-width: 0;
        }

        .project-file-manager .files-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          min-width: 0;
          margin-top: 10px;
        }

        .project-file-manager .uploaded-file-item {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-width: 0;
          padding: 10px !important;
          overflow: hidden;
        }

        .project-file-manager .file-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          overflow: hidden;
        }

        .project-file-manager .file-details {
          min-width: 0;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .project-file-manager .file-details strong,
        .project-file-manager .file-details small {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .project-file-manager .file-actions {
          display: flex !important;
          flex: 0 0 auto;
          align-items: center;
          justify-content: flex-end;
          gap: 6px !important;
          width: auto !important;
          max-width: 100%;
          min-width: max-content;
          margin: 0 !important;
          padding: 0 !important;
          flex-wrap: nowrap;
        }

        .project-file-manager .file-actions .file-action-btn {
          flex: 0 0 34px !important;
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          margin: 0 !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          border-radius: 8px !important;
        }

        .project-file-manager .file-actions .file-action-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .project-file-manager .file-actions .delete-file-btn {
          flex: 0 0 34px !important;
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
        }

        @media (max-width: 900px) {
          .project-file-manager .uploaded-file-item {
            grid-template-columns: 1fr !important;
            align-items: stretch;
          }

          .project-file-manager .file-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
            min-width: 0;
          }
        }

        @media (max-width: 480px) {
          .project-file-manager .file-actions {
            display: grid !important;
            grid-template-columns: repeat(5, 34px);
            justify-content: start;
          }
        }
      `}</style>

      {/* HEADER */}

      <div className="file-upload-title">
        <span>📁</span>

        <div>
          <strong>
            Project Files
          </strong>

          <small>
            Upload and manage your project files
          </small>
        </div>
      </div>

      {/* UPLOAD INPUT */}

      <input
        ref={fileInputRef}
        id="project-file-input"
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={
          replaceTarget
            ? handleReplaceFileSelect
            : handleFileSelect
        }
        disabled={uploading}
      />

      {/* SELECTED FILE */}

      {selectedFile && (
        <div className="selected-file-box">
          <span>📎</span>

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

      {/* UPLOAD BUTTON */}

      <button
        type="button"
        className="file-upload-primary-btn"
        onClick={handleUpload}
        disabled={
          !selectedFile ||
          uploading
        }
      >
        {uploading
          ? "Uploading..."
          : "⬆ Upload File"}
      </button>

      {/* REPLACE STATUS */}

      {replaceTarget && (
        <div className="selected-file-box">
          <span>🔄</span>

          <div>
            <strong>
              Replacing:
            </strong>

            <small>
              {replaceTarget.file_name}
            </small>
          </div>
        </div>
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
            <span>📂</span>

            <p>
              No files uploaded yet.
            </p>
          </div>
        ) : (
          <div className="files-list">

            {files.map((file) => (
              <div
                className="uploaded-file-item"
                key={file.id}
              >

                {/* FILE INFO */}

                <div className="file-info">

                  <div className="file-icon">
                    {getFileIcon(
                      file.file_name
                    )}
                  </div>

                  <div className="file-details">

                    <strong
                      title={
                        file.file_name
                      }
                    >
                      {file.file_name}
                    </strong>

                    <small>
                      {formatSize(
                        file.file_size
                      )}
                    </small>

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="file-actions">

                  {/* PREVIEW */}

                  {isPreviewable(file) && (
                    <button
                      type="button"
                      className="file-action-btn preview-btn"
                      aria-label={`Preview ${file.file_name}`}
                      onClick={() =>
                        handlePreview(
                          file
                        )
                      }
                      title="Preview"
                    >
                      👁
                    </button>
                  )}

                  {/* AI IMAGE */}

                  {isImage(file) && (
                    <button
                      type="button"
                      className="file-action-btn ai-btn"
                      aria-label={`Use ${file.file_name} as AI reference`}
                      onClick={() =>
                        handleUseImageForAI(
                          file
                        )
                      }
                      disabled={
                        selectingImage ===
                        file.id
                      }
                      title="Use this image for AI"
                    >
                      {selectingImage ===
                      file.id
                        ? "..."
                        : "✨"}
                    </button>
                  )}

                  {/* DOWNLOAD */}

                  <button
                    type="button"
                    className="file-action-btn download-btn"
                    aria-label={`Download ${file.file_name}`}
                    onClick={() =>
                      handleDownload(
                        file
                      )
                    }
                    title="Download"
                  >
                    ↓
                  </button>

                  {/* REPLACE */}

                  <button
                    type="button"
                    className="file-action-btn replace-btn"
                    aria-label={`Replace ${file.file_name}`}
                    onClick={() =>
                      handleStartReplace(
                        file
                      )
                    }
                    disabled={uploading}
                    title="Replace"
                  >
                    🔄
                  </button>

                  {/* DELETE */}

                  <button
                    type="button"
                    className="file-action-btn delete-file-btn"
                    aria-label={`Delete ${file.file_name}`}
                    onClick={() =>
                      handleDelete(
                        file
                      )
                    }
                    disabled={uploading}
                    title="Delete"
                  >
                    🗑
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}

      </div>

    </div>
  );
}

export default FileUpload;