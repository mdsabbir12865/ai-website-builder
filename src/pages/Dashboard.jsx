import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [showCreateProject, setShowCreateProject] =
    useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("Business");
  const [projectPrompt, setProjectPrompt] = useState("");

  // Project Management
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Rename
  const [renameProject, setRenameProject] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const navigate = useNavigate();

  /*
  ========================================================
  CHECK USER
  ========================================================
  */

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      setUser(user);
      setLoading(false);
    }

    checkUser();
  }, [navigate]);

  /*
  ========================================================
  LOAD PROJECTS
  ========================================================
  */

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  async function loadProjects() {
    if (!user) return;

    setProjectsLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Project loading error:",
        error
      );

      setProjectsLoading(false);
      return;
    }

    setProjects(data || []);
    setProjectsLoading(false);
  }

  /*
  ========================================================
  LOGOUT
  ========================================================
  */

  async function handleLogout() {
    await supabase.auth.signOut();

    navigate("/login", {
      replace: true,
    });
  }

  /*
  ========================================================
  CREATE PROJECT
  ========================================================
  */

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

    setActionLoading("create");

    const {
      data,
      error,
    } = await supabase
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
      console.error(
        "Project creation error:",
        error
      );

      alert(
        "Project create failed: " +
          error.message
      );

      setActionLoading(null);
      return;
    }

    console.log(
      "Project created:",
      data
    );

    await loadProjects();

    setProjectName("");
    setProjectType("Business");
    setProjectPrompt("");
    setShowCreateProject(false);
    setActionLoading(null);
  }

  /*
  ========================================================
  SEARCH
  ========================================================
  */

  const filteredProjects = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    if (!query) {
      return projects;
    }

    return projects.filter(
      (project) =>
        project.name
          ?.toLowerCase()
          .includes(query) ||
        project.type
          ?.toLowerCase()
          .includes(query) ||
        project.prompt
          ?.toLowerCase()
          .includes(query)
    );
  }, [
    projects,
    searchQuery,
  ]);

  /*
  ========================================================
  DELETE PROJECT
  ========================================================
  */

  async function handleDeleteProject(project) {
    if (!user) return;

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${project.name}"?\n\nThis action cannot be undone.`
      );

    if (!confirmed) return;

    setActionLoading(
      `delete-${project.id}`
    );

    const {
      error,
    } = await supabase
      .from("projects")
      .delete()
      .eq(
        "id",
        project.id
      )
      .eq(
        "user_id",
        user.id
      );

    if (error) {
      console.error(
        "Delete project error:",
        error
      );

      alert(
        "Project delete failed: " +
          error.message
      );

      setActionLoading(null);
      return;
    }

    setProjects(
      (previous) =>
        previous.filter(
          (item) =>
            item.id !==
            project.id
        )
    );

    setActionLoading(null);
  }

  /*
  ========================================================
  RENAME PROJECT
  ========================================================
  */

  function openRenameModal(project) {
    setRenameProject(project);
    setRenameValue(
      project.name || ""
    );
  }

  function closeRenameModal() {
    setRenameProject(null);
    setRenameValue("");
  }

  async function handleRenameProject() {
    if (!user || !renameProject) {
      return;
    }

    const newName =
      renameValue.trim();

    if (!newName) {
      alert(
        "Please enter a project name."
      );

      return;
    }

    setActionLoading(
      `rename-${renameProject.id}`
    );

    const {
      data,
      error,
    } = await supabase
      .from("projects")
      .update({
        name: newName,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        renameProject.id
      )
      .eq(
        "user_id",
        user.id
      )
      .select()
      .single();

    if (error) {
      console.error(
        "Rename project error:",
        error
      );

      alert(
        "Rename failed: " +
          error.message
      );

      setActionLoading(null);
      return;
    }

    setProjects(
      (previous) =>
        previous.map(
          (item) =>
            item.id ===
            renameProject.id
              ? {
                  ...item,
                  name:
                    data.name,
                  updated_at:
                    data.updated_at,
                }
              : item
        )
    );

    closeRenameModal();
    setActionLoading(null);
  }

  /*
  ========================================================
  DUPLICATE PROJECT
  ========================================================
  */

  async function handleDuplicateProject(project) {
    if (!user) return;

    setActionLoading(
      `duplicate-${project.id}`
    );

    const {
      data,
      error,
    } = await supabase
      .from("projects")
      .insert([
        {
          user_id: user.id,

          name:
            `${project.name} Copy`,

          type:
            project.type ||
            "Business",

          prompt:
            project.prompt ||
            "",

          html_code:
            project.html_code ||
            "",

          css_code:
            project.css_code ||
            "",

          js_code:
            project.js_code ||
            "",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(
        "Duplicate project error:",
        error
      );

      alert(
        "Duplicate failed: " +
          error.message
      );

      setActionLoading(null);
      return;
    }

    setProjects(
      (previous) => [
        data,
        ...previous,
      ]
    );

    setActionLoading(null);
  }

  /*
  ========================================================
  LOADING
  ========================================================
  */

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>

        <p>
          Loading dashboard...
        </p>
      </div>
    );
  }

  /*
  ========================================================
  RENDER
  ========================================================
  */

  return (
    <div className="dashboard-page">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="dashboard-sidebar">

        <div className="dashboard-logo">
          <span>✦</span>
          WebAI
        </div>

        <nav className="dashboard-nav">

          <a
            className="active"
            href="#"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            <span>⌂</span>
            Dashboard
          </a>

          <a
            href="#projects"
            onClick={(e) => {
              e.preventDefault();

              document
                .getElementById(
                  "projects"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                });
            }}
          >
            <span>◫</span>
            Projects
          </a>

          <a
            href="#"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            <span>✦</span>
            AI Builder
          </a>

          <a
            href="#"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            <span>▣</span>
            Templates
          </a>

        </nav>

        <div className="sidebar-bottom">

          <a
            href="#"
            onClick={(e) =>
              e.preventDefault()
            }
          >
            <span>⚙</span>
            Settings
          </a>

          <button
            onClick={handleLogout}
          >
            <span>↪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* ==================================================
          MAIN
      ================================================== */}

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
              {user?.email
                ?.charAt(0)
                .toUpperCase() ||
                "U"}
            </div>

            <div className="user-info">

              <strong>
                {user
                  ?.user_metadata
                  ?.full_name ||
                  "User"}
              </strong>

              <span>
                {user?.email}
              </span>

            </div>

          </div>

        </header>

        {/* ==================================================
            HERO
        ================================================== */}

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
            onClick={() =>
              setShowCreateProject(
                true
              )
            }
          >
            + Create New Project
          </button>

        </section>

        {/* ==================================================
            STATS
        ================================================== */}

        <section className="dashboard-stats">

          <div className="stat-card">

            <span>◫</span>

            <p>
              Projects
            </p>

            <strong>
              {projects.length}
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

        {/* ==================================================
            PROJECTS
        ================================================== */}

        <section
          className="projects-section"
          id="projects"
        >

          <div className="section-top">

            <div>

              <span>
                YOUR WORKSPACE
              </span>

              <h2>
                Recent Projects
              </h2>

            </div>

            <button
              onClick={() =>
                setShowCreateProject(
                  true
                )
              }
            >
              + New Project
            </button>

          </div>

          {/* SEARCH */}

          {!projectsLoading &&
            projects.length > 0 && (
              <div className="projects-toolbar">

                <div className="project-search">

                  <span>
                    🔍
                  </span>

                  <input
                    type="text"
                    placeholder="Search your projects..."
                    value={
                      searchQuery
                    }
                    onChange={(e) =>
                      setSearchQuery(
                        e.target.value
                      )
                    }
                  />

                  {searchQuery && (
                    <button
                      className="clear-search"
                      onClick={() =>
                        setSearchQuery(
                          ""
                        )
                      }
                    >
                      ×
                    </button>
                  )}

                </div>

                <span className="project-count">
                  {filteredProjects.length}{" "}
                  {filteredProjects.length ===
                  1
                    ? "project"
                    : "projects"}
                </span>

              </div>
            )}

          {/* LOADING */}

          {projectsLoading ? (
            <div className="empty-projects">

              <div className="empty-icon">
                ⟳
              </div>

              <h3>
                Loading projects...
              </h3>

              <p>
                Please wait while we load
                your projects.
              </p>

            </div>
          ) : projects.length === 0 ? (

            /* NO PROJECTS */

            <div className="empty-projects">

              <div className="empty-icon">
                ✦
              </div>

              <h3>
                No projects yet
              </h3>

              <p>
                Create your first AI-powered
                website and it will appear
                here.
              </p>

              <button
                className="empty-create-btn"
                onClick={() =>
                  setShowCreateProject(
                    true
                  )
                }
              >
                + Create your first project
              </button>

            </div>

          ) : filteredProjects.length ===
            0 ? (

            /* SEARCH EMPTY */

            <div className="empty-projects">

              <div className="empty-icon">
                🔍
              </div>

              <h3>
                No projects found
              </h3>

              <p>
                Try searching with a
                different project name,
                type or description.
              </p>

              <button
                className="empty-create-btn"
                onClick={() =>
                  setSearchQuery("")
                }
              >
                Clear Search
              </button>

            </div>

          ) : (

            /* PROJECT GRID */

            <div className="projects-grid">

              {filteredProjects.map(
                (project) => (

                  <div
                    className="project-card"
                    key={
                      project.id
                    }
                  >

                    <div className="project-card-top">

                      <div className="project-icon">
                        ✦
                      </div>

                      <span className="project-type">
                        {project.type ||
                          "Website"}
                      </span>

                    </div>

                    <h3>
                      {project.name}
                    </h3>

                    <p>
                      {project.prompt ||
                        "No description provided."}
                    </p>

                    <div className="project-card-bottom">

                      <span>
                        {project.created_at
                          ? new Date(
                              project.created_at
                            ).toLocaleDateString()
                          : ""}
                      </span>

                      <div className="project-actions">

                        <button
                          className="project-action-btn"
                          title="Rename"
                          onClick={() =>
                            openRenameModal(
                              project
                            )
                          }
                        >
                          ✎
                        </button>

                        <button
                          className="project-action-btn"
                          title="Duplicate"
                          disabled={
                            actionLoading ===
                            `duplicate-${project.id}`
                          }
                          onClick={() =>
                            handleDuplicateProject(
                              project
                            )
                          }
                        >
                          {actionLoading ===
                          `duplicate-${project.id}`
                            ? "..."
                            : "⧉"}
                        </button>

                        <button
                          className="project-action-btn danger"
                          title="Delete"
                          disabled={
                            actionLoading ===
                            `delete-${project.id}`
                          }
                          onClick={() =>
                            handleDeleteProject(
                              project
                            )
                          }
                        >
                          {actionLoading ===
                          `delete-${project.id}`
                            ? "..."
                            : "⌫"}
                        </button>

                        <button
                          className="project-open-btn"
                          onClick={() =>
                            navigate(
                              `/builder/${project.id}`
                            )
                          }
                        >
                          Open →
                        </button>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

      </main>

      {/* ==================================================
          CREATE PROJECT MODAL
      ================================================== */}

      {showCreateProject && (

        <div
          className="project-modal-overlay"
          onClick={() =>
            setShowCreateProject(
              false
            )
          }
        >

          <div
            className="project-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="project-modal-header">

              <div>

                <span>
                  ✦ NEW PROJECT
                </span>

                <h2>
                  Create your project
                </h2>

                <p>
                  Tell us what you want
                  to build.
                </p>

              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowCreateProject(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="project-form">

              <div className="input-group">

                <label>
                  Project Name
                </label>

                <input
                  type="text"
                  placeholder="My awesome website"
                  value={
                    projectName
                  }
                  onChange={(e) =>
                    setProjectName(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="input-group">

                <label>
                  Website Type
                </label>

                <select
                  value={
                    projectType
                  }
                  onChange={(e) =>
                    setProjectType(
                      e.target.value
                    )
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

              <div className="input-group">

                <label>
                  What do you want to build?
                </label>

                <textarea
                  rows="5"
                  placeholder="Example: Create a modern restaurant website with a dark theme, menu section, reservation button and contact information."
                  value={
                    projectPrompt
                  }
                  onChange={(e) =>
                    setProjectPrompt(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="project-modal-actions">

                <button
                  type="button"
                  className="cancel-project-btn"
                  onClick={() =>
                    setShowCreateProject(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="start-project-btn"
                  onClick={
                    handleCreateProject
                  }
                  disabled={
                    actionLoading ===
                    "create"
                  }
                >
                  {actionLoading ===
                  "create"
                    ? "Creating..."
                    : "Start Building →"}
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* ==================================================
          RENAME MODAL
      ================================================== */}

      {renameProject && (

        <div
          className="project-modal-overlay"
          onClick={
            closeRenameModal
          }
        >

          <div
            className="project-modal rename-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="project-modal-header">

              <div>

                <span>
                  ✎ PROJECT
                </span>

                <h2>
                  Rename project
                </h2>

                <p>
                  Choose a new name for
                  your project.
                </p>

              </div>

              <button
                className="modal-close"
                onClick={
                  closeRenameModal
                }
              >
                ×
              </button>

            </div>

            <div className="project-form">

              <div className="input-group">

                <label>
                  Project Name
                </label>

                <input
                  type="text"
                  autoFocus
                  value={
                    renameValue
                  }
                  onChange={(e) =>
                    setRenameValue(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key ===
                      "Enter"
                    ) {
                      handleRenameProject();
                    }
                  }}
                />

              </div>

              <div className="project-modal-actions">

                <button
                  type="button"
                  className="cancel-project-btn"
                  onClick={
                    closeRenameModal
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="start-project-btn"
                  onClick={
                    handleRenameProject
                  }
                  disabled={
                    actionLoading ===
                    `rename-${renameProject.id}`
                  }
                >
                  {actionLoading ===
                  `rename-${renameProject.id}`
                    ? "Saving..."
                    : "Save Name"}
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