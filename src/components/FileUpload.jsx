import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function FileUpload({ projectId }) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
            err?.message || "Failed to initialize file manager."
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

      setFiles(data || []);
    } catch (err) {
      console.error("Load files error:", err);

      setError(
        err?.message || "Failed to load project files."
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
      [
        "txt",
      ].includes(extension)
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

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="project-file-manager">

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
        onClick={
          handleUpload
        }
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

                  {isPreviewable(file) && (
                    <button
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

                  <button
                    onClick={() =>
                      handleDownload(
                        file
                      )
                    }
                    title="Download"
                  >
                    ↓
                  </button>

                  <button
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

                  <button
                    className="delete-file-btn"
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
