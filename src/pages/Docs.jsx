import React from "react";

function Docs() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0d10",
        color: "#f5f5f5",
        padding: "60px 20px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "50px" }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 12px",
              borderRadius: "999px",
              background: "#171a21",
              color: "#8ab4ff",
              fontSize: "13px",
              marginBottom: "18px",
            }}
          >
            WebAI Builder Documentation
          </div>

          <h1
            style={{
              fontSize: "42px",
              lineHeight: "1.1",
              margin: "0 0 16px",
            }}
          >
            WebAI Builder
          </h1>

          <p
            style={{
              color: "#a7adb8",
              fontSize: "18px",
              lineHeight: "1.7",
              maxWidth: "700px",
            }}
          >
            WebAI Builder is an AI-powered website builder that lets users
            generate, edit, preview, save, and deploy websites using HTML,
            CSS, and JavaScript.
          </p>
        </div>

        <section style={{ marginBottom: "42px" }}>
          <h2>Getting Started</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            Create an account, open the Builder, describe the website you want
            to create, and use AI generation to create your website.
          </p>
        </section>

        <section style={{ marginBottom: "42px" }}>
          <h2>AI Website Generation</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            Describe your website idea in the Builder prompt. WebAI Builder
            generates the website structure, styling, and JavaScript code.
          </p>
        </section>

        <section style={{ marginBottom: "42px" }}>
          <h2>Code Editor</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            Generated websites can be customized using the HTML, CSS, and
            JavaScript editors inside the Builder.
          </p>
        </section>

        <section style={{ marginBottom: "42px" }}>
          <h2>Live Preview</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            Use the Live Preview to see how your generated website looks while
            editing the code.
          </p>
        </section>

        <section style={{ marginBottom: "42px" }}>
          <h2>Vercel Deployment</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            Users can connect their Vercel account, select or create a Vercel
            project, and deploy their generated website.
          </p>
        </section>

        <section style={{ marginBottom: "42px" }}>
          <h2>GitHub Integration</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            WebAI Builder can connect to GitHub and export website files to a
            repository for version control and further development.
          </p>
        </section>

        <section>
          <h2>Support</h2>

          <p style={{ color: "#a7adb8", lineHeight: "1.7" }}>
            For support, visit the WebAI Builder website or contact the support
            team through the available support channels.
          </p>
        </section>

        <div
          style={{
            marginTop: "70px",
            paddingTop: "25px",
            borderTop: "1px solid #22262e",
            color: "#6f7682",
            fontSize: "14px",
          }}
        >
          © {new Date().getFullYear()} WebAI Builder
        </div>
      </div>
    </div>
  );
}

export default Docs;