import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
const [projects, setProjects] = useState([]);
const [projectsLoading, setProjectsLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("Business");
  const [projectPrompt, setProjectPrompt] = useState("");

  const navigate = useNavigate();

  // Check logged-in user
  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(user);
      setLoading(false);
    }

    checkUser();
  }, [navigate]);
  useEffect(() => {
  if (user) {
    loadProjects();
  }
}, [user]);

  // Logout
  async function handleLogout() {
    await supabase.auth.signOut();

    navigate("/login", { replace: true });
  }
async function loadProjects() {
  if (!user) return;

  setProjectsLoading(true);

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Project loading error:", error);
    setProjectsLoading(false);
    return;
  }

  setProjects(data || []);
  setProjectsLoading(false);
}
  // Create project
async function handleCreateProject() {
  if (!projectName.trim()) {
    alert("Please enter a project name.");
    return;
  }

  if (!projectPrompt.trim()) {
    alert("Please describe your website.");
    return;
  }

  if (!user) {
    alert("Please login first.");
    return;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert([
      {
        user_id: user.id,
        name: projectName.trim(),
        type: projectType,
        prompt: projectPrompt.trim(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Project creation error:", error);
    alert("Project create failed: " + error.message);
    return;
  }

  console.log("Project created:", data);

  alert("Project created successfully! 🎉");
await loadProjects();
  setProjectName("");
  setProjectType("Business");
  setProjectPrompt("");
  setShowCreateProject(false);
}
  // Loading screen
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      {/* =========================
          SIDEBAR
      ========================== */}

      <aside className="dashboard-sidebar">

        <div className="dashboard-logo">
          <span>✦</span>
          WebAI
        </div>

        <nav className="dashboard-nav">

          <a
            className="active"
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            <span>⌂</span>
            Dashboard
          </a>

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            <span>◫</span>
            Projects
          </a>

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            <span>✦</span>
            AI Builder
          </a>

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            <span>▣</span>
            Templates
          </a>

        </nav>

        <div className="sidebar-bottom">

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
          >
            <span>⚙</span>
            Settings
          </a>

          <button onClick={handleLogout}>

            <span>↪</span>
            Logout
          </button>
        </div>

      </aside>


      {/* =========================
          MAIN DASHBOARD
      ========================== */}

      <main className="dashboard-main">

        {/* HEADER */}

        <header className="dashboard-header">

          <div>
            <p className="dashboard-label">
              DASHBOARD
            </p>

            <h1>
              Welcome back 👋
            </h1>
          </div>

          <div className="user-box">

            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>

            <div className="user-info">

              <strong>
                {user?.user_metadata?.full_name || "User"}
              </strong>

              <span>
                {user?.email}
              </span>

            </div>

          </div>

        </header>


        {/* =========================
            HERO
        ========================== */}

        <section className="dashboard-hero">

          <div>

            <span className="dashboard-badge">
              ✦ AI WEBSITE BUILDER
            </span>

            <h2>
              What do you want
              <br />
              to build today?
            </h2>

            <p>
              Describe your idea and let AI
              turn it into a real website.
            </p>

          </div>

          <button
            className="create-project-btn"
            onClick={() => setShowCreateProject(true)}
          >
            + Create New Project
          </button>

        </section>


        {/* =========================
            STATS
        ========================== */}

        <section className="dashboard-stats">

          <div className="stat-card">

            <span>◫</span>

            <p>
              Projects
            </p>

            <strong>
              0
            </strong>

          </div>


          <div className="stat-card">

            <span>✦</span>

            <p>
              AI Generations
            </p>

            <strong>
              0
            </strong>

          </div>


          <div className="stat-card">

            <span>↗</span>

            <p>
              Published
            </p>

            <strong>
              0
            </strong>

          </div>

        </section>


        {/* =========================
            PROJECTS
        ========================== */}

        <section className="projects-section">

          <div className="section-top">

            <div>

              <span>
                YOUR WORKSPACE
              </span>

              <h2>
                Recent Projects
              </h2>

            </div>

            <button>
              View all →
            </button>

          </div>
{projectsLoading ? (

  <div className="empty-projects">
    <div className="empty-icon">
      ⟳
    </div>

    <h3>
      Loading projects...
    </h3>

    <p>
      Please wait while we load your projects.
    </p>
  </div>

) : projects.length === 0 ? (

  <div className="empty-projects">

    <div className="empty-icon">
      ✦
    </div>

    <h3>
      No projects yet
    </h3>

    <p>
      Create your first AI-powered
      website and it will appear here.
    </p>

    <button
      className="empty-create-btn"
      onClick={() => setShowCreateProject(true)}
    >
      + Create your first project
    </button>

  </div>

) : (

  <div className="projects-grid">

    {projects.map((project) => (

      <div
        className="project-card"
        key={project.id}
      >

        <div className="project-card-top">

          <div className="project-icon">
            ✦
          </div>

          <span className="project-type">
            {project.type}
          </span>

        </div>


        <h3>
          {project.name}
        </h3>


        <p>
          {project.prompt}
        </p>


        <div className="project-card-bottom">

          <span>
            {new Date(project.created_at).toLocaleDateString()}
          </span>

<button
  onClick={() => navigate(`/builder/${project.id}`)}
>
  Open →
</button>
        </div>

      </div>

    ))}

  </div>

)}
        </section>

      </main>


      {/* =========================
          CREATE PROJECT MODAL
      ========================== */}

      {showCreateProject && (

        <div
          className="project-modal-overlay"
          onClick={() => setShowCreateProject(false)}
        >

          <div
            className="project-modal"
            onClick={(e) => e.stopPropagation()}
          >

            {/* MODAL HEADER */}

            <div className="project-modal-header">

              <div>

                <span>
                  ✦ NEW PROJECT
                </span>

                <h2>
                  Create your project
                </h2>

                <p>
                  Tell us what you want to build.
                </p>

              </div>


              <button
                className="modal-close"
                onClick={() => setShowCreateProject(false)}
              >
                ×
              </button>

            </div>


            {/* FORM */}

            <div className="project-form">

              {/* PROJECT NAME */}

              <div className="input-group">

                <label>
                  Project Name
                </label>

                <input
                  type="text"
                  placeholder="My awesome website"
                  value={projectName}
                  onChange={(e) =>
                    setProjectName(e.target.value)
                  }
                />

              </div>


              {/* WEBSITE TYPE */}

              <div className="input-group">

                <label>
                  Website Type
                </label>

                <select
                  value={projectType}
                  onChange={(e) =>
                    setProjectType(e.target.value)
                  }
                >

                  <option>
                    Business
                  </option>

                  <option>
                    Portfolio
                  </option>

                  <option>
                    Restaurant
                  </option>

                  <option>
                    Blog
                  </option>

                  <option>
                    Landing Page
                  </option>

                  <option>
                    Gaming
                  </option>

                  <option>
                    Online Store
                  </option>

                  <option>
                    Other
                  </option>

                </select>

              </div>


              {/* AI PROMPT */}

              <div className="input-group">

                <label>
                  What do you want to build?
                </label>

                <textarea
                  rows="5"
                  placeholder="Example: Create a modern restaurant website with a dark theme, menu section, reservation button and contact information."
                  value={projectPrompt}
                  onChange={(e) =>
                    setProjectPrompt(e.target.value)
                  }
                />

              </div>


              {/* BUTTONS */}

              <div className="project-modal-actions">

                <button
                  type="button"
                  className="cancel-project-btn"
                  onClick={() =>
                    setShowCreateProject(false)
                  }
                >
                  Cancel
                </button>


                <button
                  type="button"
                  className="start-project-btn"
                  onClick={handleCreateProject}
                >
                  Start Building →
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Dashboard;