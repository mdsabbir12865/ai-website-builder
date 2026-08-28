import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function FileUpload({ projectId, onAttachFile, attachedFileIds = [] }) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        loadFiles(user.id, projectId);
      }
    }
    init();
  }, [projectId]);

  async function loadFiles(userId, pId) {
    setLoading(true);
    const { data } = await supabase.from("project_files").select("*").eq("project_id", pId).order("created_at", { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }

  async function handleUpload() {
    if (!selectedFile || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${projectId}/${Date.now()}-${selectedFile.name}`;
      await supabase.storage.from("uploads").upload(path, selectedFile);
      await supabase.from("project_files").insert({
        user_id: user.id, project_id: projectId, file_name: selectedFile.name, file_path: path, file_type: selectedFile.type, file_size: selectedFile.size
      });
      setSelectedFile(null);
      loadFiles(user.id, projectId);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handleAttach(file) {
    const { data } = await supabase.storage.from("uploads").download(file.file_path);
    const reader = new FileReader();
    reader.onloadend = () => {
      onAttachFile({
        id: file.id,
        name: file.file_name,
        type: file.file_type,
        base64: reader.result.split(",")[1],
        url: URL.createObjectURL(data)
      });
    };
    reader.readAsDataURL(data);
  }

  return (
    <div className="project-file-manager">
      <div className="file-upload-controls">
        <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} hidden />
        <button onClick={() => fileInputRef.current.click()} className="upload-select-btn">
          {selectedFile ? selectedFile.name : "📁 Choose Design Reference"}
        </button>
        <button onClick={handleUpload} disabled={!selectedFile || uploading} className="upload-confirm-btn">
          {uploading ? "..." : "Upload"}
        </button>
      </div>
      <div className="files-list">
        {files.map(file => (
          <div key={file.id} className={`uploaded-file-item ${attachedFileIds.includes(file.id) ? "attached" : ""}`}>
             <span className="file-name">{file.file_name}</span>
             <button onClick={() => handleAttach(file)} className="attach-btn" title="Attach to AI">✦</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FileUpload;