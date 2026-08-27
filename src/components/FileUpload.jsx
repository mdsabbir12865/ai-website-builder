import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function FileUpload() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Get logged-in user
  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        loadFiles(user.id);
      } else {
        setLoadingFiles(false);
      }
    }

    getUser();
  }, []);

  // Load user's files
  async function loadFiles(userId) {
    setLoadingFiles(true);
    setError("");

    try {
      const { data, error } = await supabase.storage
        .from("uploads")
        .list(userId, {
          limit: 100,
          sortBy: {
            column: "created_at",
            order: "desc",
          },
        });

      if (error) throw error;

      setFiles(data || []);
    } catch (err) {
      console.error("Load files error:", err);
      setError(err.message || "Failed to load files.");
    } finally {
      setLoadingFiles(false);
    }
  }

  // Upload file
  async function handleUpload() {
    if (!selectedFile) {
      setError("Please choose a file first.");
      return;
    }

    if (!user) {
      setError("You are not logged in.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const fileExt = selectedFile.name.includes(".")
        ? selectedFile.name.split(".").pop()
        : "";

      const fileName = `${crypto.randomUUID()}${
        fileExt ? `.${fileExt}` : ""
      }`;

      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setMessage("File uploaded successfully.");
      setSelectedFile(null);

      // Reset file input
      const input = document.getElementById("project-file-input");
      if (input) {
        input.value = "";
      }

      await loadFiles(user.id);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Download file
  async function handleDownload(fileName) {
    if (!user) return;

    try {
      setError("");

      const filePath = `${user.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("uploads")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error("Download error:", err);
      setError(err.message || "Download failed.");
    }
  }

  // Delete file
  async function handleDelete(fileName) {
    if (!user) return;

    const confirmed = window.confirm(
      `Delete "${fileName}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const filePath = `${user.id}/${fileName}`;

      const { error } = await supabase.storage
        .from("uploads")
        .remove([filePath]);

      if (error) throw error;

      setMessage("File deleted successfully.");

      await loadFiles(user.id);
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message || "Delete failed.");
    }
  }

  // File size
  function formatFileSize(bytes) {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  }

  // File icon
  function getFileIcon(name) {
    const ext = name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
    ) {
      return "🖼️";
    }

    if (
      ["mp4", "webm", "mov", "avi"].includes(ext)
    ) {
      return "🎬";
    }

    if (
      ["mp3", "wav", "ogg"].includes(ext)
    ) {
      return "🎵";
    }

    if (ext === "pdf") {
      return "📕";
    }

    if (
      ["zip", "rar", "7z"].includes(ext)
    ) {
      return "📦";
    }

    return "📄";
  }

  return (
    <div className="file-upload-section">
      <div className="file-upload-title">
        <span>📁</span>

        <div>
          <strong>Project Files</strong>
          <small>
            Upload and manage your files
          </small>
        </div>
      </div>

      {/* Upload */}
      <input
        id="project-file-input"
        type="file"
        onChange={(event) => {
          setSelectedFile(
            event.target.files?.[0] || null
          );

          setMessage("");
          setError("");
        }}
        disabled={uploading}
      />

      {selectedFile && (
        <p className="selected-file">
          Selected: {selectedFile.name}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
      >
        {uploading
          ? "Uploading..."
          : "⬆ Upload File"}
      </button>

      {/* Messages */}
      {message && (
        <p className="file-success">
          ✓ {message}
        </p>
      )}

      {error && (
        <p className="file-error">
          ⚠ {error}
        </p>
      )}

      {/* Files */}
      <div className="uploaded-files">
        <div className="uploaded-files-header">
          <strong>Your Files</strong>
          <span>{files.length}</span>
        </div>

        {loadingFiles ? (
          <div className="files-loading">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="empty-files">
            <span>📂</span>
            <p>No files uploaded yet.</p>
          </div>
        ) : (
          <div className="files-list">
            {files.map((file) => (
              <div
                className="uploaded-file-item"
                key={file.id || file.name}
              >
                <div className="file-info">
                  <div className="file-icon">
                    {getFileIcon(file.name)}
                  </div>

                  <div className="file-details">
                    <strong title={file.name}>
                      {file.name}
                    </strong>

                    <small>
                      {formatFileSize(
                        file.metadata?.size || 0
                      )}
                    </small>
                  </div>
                </div>

                <div className="file-actions">
                  <button
                    onClick={() =>
                      handleDownload(file.name)
                    }
                    title="Download"
                  >
                    ↓
                  </button>

                  <button
                    className="delete-file-btn"
                    onClick={() =>
                      handleDelete(file.name)
                    }
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