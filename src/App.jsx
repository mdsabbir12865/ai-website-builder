import "./App.css";
import { Routes, Route, Link } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Builder from "./pages/Builder";
function LandingPage() {
  return (
    <div className="app">

      {/* ================= NAVBAR ================= */}
      <nav className="navbar">

        <div className="logo">
          <span className="logo-icon">✦</span>
          WebAI
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className="nav-actions">

          <Link to="/login" className="login-btn">
            Login
          </Link>

          <Link to="/login" className="get-started">
            Get Started
          </Link>

        </div>

      </nav>


      {/* ================= HERO ================= */}
      <section className="hero">

        <div className="hero-content">

          <div className="badge">
            ✨ AI-powered website builder
          </div>

          <h1>
            Build Websites
            <span>With AI.</span>
          </h1>

          <p>
            Turn your ideas into beautiful, production-ready websites
            with a single prompt. No coding experience required.
          </p>

          <div className="hero-buttons">

            <Link to="/login" className="primary-btn">
              Start Building <span>→</span>
            </Link>

            <button className="secondary-btn">
              ▶ Watch Demo
            </button>

          </div>

          <div className="trusted">
            <span>⚡</span>
            Create faster. Build smarter. Launch instantly.
          </div>

        </div>


        {/* ================= AI BUILDER PREVIEW ================= */}
        <div className="builder-wrapper">

          <div className="builder-window">

            <div className="window-top">

              <div className="dots">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="window-title">
                AI Website Builder
              </div>

              <div className="window-status">
                ● Live
              </div>

            </div>


            <div className="builder-body">

              <div className="prompt-panel">

                <div className="panel-title">
                  <span>✦</span>
                  AI Prompt
                </div>

                <div className="prompt-box">
                  Create a modern SaaS landing page
                  for an AI website builder.
                </div>

                <button className="generate-btn">
                  ✦ Generate Website
                </button>

              </div>


              <div className="code-panel">

                <div className="panel-title">
                  &lt;/&gt; Code
                </div>

                <div className="code-lines">

                  <span>
                    <b>01</b> &lt;div className="hero"&gt;
                  </span>

                  <span>
                    <b>02</b> &nbsp;&nbsp;&lt;h1&gt;Build with AI&lt;/h1&gt;
                  </span>

                  <span>
                    <b>03</b> &nbsp;&nbsp;&lt;p&gt;Create faster...&lt;/p&gt;
                  </span>

                  <span>
                    <b>04</b> &nbsp;&nbsp;&lt;button&gt;Get Started&lt;/button&gt;
                  </span>

                  <span>
                    <b>05</b> &lt;/div&gt;
                  </span>

                </div>

              </div>


              <div className="preview-panel">

                <div className="panel-title">
                  <span>◉</span>
                  Live Preview
                </div>

                <div className="mini-site">

                  <div className="mini-nav">
                    <strong>Nova</strong>

                    <div>
                      Home &nbsp; Features &nbsp; Contact
                    </div>
                  </div>

                  <div className="mini-content">

                    <small>AI POWERED</small>

                    <h3>
                      Build Something
                      Amazing.
                    </h3>

                    <p>
                      Your idea. Our AI.
                      One beautiful website.
                    </p>

                    <button>
                      Get Started →
                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= FEATURES ================= */}
      <section className="features" id="features">

        <div className="section-heading">

          <span>POWERFUL FEATURES</span>

          <h2>
            Everything you need to
            <br />
            build with AI.
          </h2>

        </div>


        <div className="feature-grid">

          <div className="feature-card">

            <div className="feature-icon">
              ✦
            </div>

            <h3>AI Generation</h3>

            <p>
              Describe your idea and let AI
              generate a complete website.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              ◉
            </div>

            <h3>Live Preview</h3>

            <p>
              See your website update instantly
              while you build.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              &lt;/&gt;
            </div>

            <h3>Code Editing</h3>

            <p>
              Edit HTML, CSS and JavaScript
              with complete control.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              ↗
            </div>

            <h3>One-click Export</h3>

            <p>
              Export your finished website
              whenever you're ready.
            </p>

          </div>

        </div>

      </section>


      {/* ================= HOW IT WORKS ================= */}
      <section className="how-it-works" id="how-it-works">

        <div className="section-heading">

          <span>HOW IT WORKS</span>

          <h2>
            From idea to website
            <br />
            in four simple steps.
          </h2>

        </div>


        <div className="steps">

          <div className="step">
            <div className="step-number">01</div>
            <h3>Describe</h3>
            <p>
              Tell our AI what kind of website you want.
            </p>
          </div>


          <div className="step">
            <div className="step-number">02</div>
            <h3>Generate</h3>
            <p>
              AI creates your website automatically.
            </p>
          </div>


          <div className="step">
            <div className="step-number">03</div>
            <h3>Customize</h3>
            <p>
              Edit the design and code exactly how you want.
            </p>
          </div>


          <div className="step">
            <div className="step-number">04</div>
            <h3>Deploy</h3>
            <p>
              Publish your website and share it with the world.
            </p>
          </div>

        </div>

      </section>


      {/* ================= CTA ================= */}
      <section className="cta" id="pricing">

        <div className="cta-box">

          <h2>
            Build your first
            <br />
            website with AI.
          </h2>

          <p>
            Turn your idea into reality today.
          </p>

          <Link to="/login" className="primary-btn">
            Get Started Free →
          </Link>

        </div>

      </section>


      {/* ================= FOOTER ================= */}
      <footer className="footer">

        <div className="footer-logo">
          <span>✦</span>
          WebAI
        </div>

        <div className="footer-links">

          <a href="#features">
            Features
          </a>

          <a href="#how-it-works">
            How It Works
          </a>

          <a href="#pricing">
            Pricing
          </a>

        </div>

        <div className="socials">
          <span>𝕏</span>
          <span>◉</span>
          <span>in</span>
        </div>

        <div className="copyright">
          © 2026 WebAI. All rights reserved.
        </div>

      </footer>

    </div>
  );
}


function App() {
  return (
    <Routes>

      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
<Route path="/builder/:projectId" element={<Builder />} />
    </Routes>
  );
}

export default App;