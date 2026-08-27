import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setMessage("Email এবং Password দিন।");
      return;
    }

    setLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        console.error("Login error:", error);

        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data?.session || !data?.user) {
        console.error(
          "Login succeeded but no session/user returned:",
          data
        );

        setMessage(
          "Login session could not be created. Please try again."
        );

        setLoading(false);
        return;
      }

      console.log("Login successful:", data.user.id);

      /*
       * Give Supabase auth state a moment to finish
       * updating before navigating.
       */
      await new Promise((resolve) =>
        setTimeout(resolve, 150)
      );

      setLoading(false);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      console.error("Unexpected login error:", error);

      setMessage(
        error?.message ||
          "Something went wrong while logging in."
      );

      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* LOGO */}
        <div className="auth-logo">
          <span>✦</span>
          WebAI
        </div>

        {/* HEADING */}
        <div className="auth-heading">
          <h1>Welcome back</h1>

          <p>
            Login to continue building websites with AI.
          </p>
        </div>

        {/* LOGIN FORM */}
        <form
          className="auth-form"
          onSubmit={handleLogin}
        >

          {/* EMAIL */}
          <div className="input-group">
            <label>Email</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) =>
                setEmail(e.target.value)
              }
              disabled={loading}
            />
          </div>

          {/* PASSWORD */}
          <div className="input-group">

            <div className="password-label">
              <label>Password</label>

              <button
                type="button"
                onClick={() => {
                  setMessage(
                    "Password reset is not available yet."
                  );
                }}
              >
                Forgot password?
              </button>
            </div>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) =>
                setPassword(e.target.value)
              }
              disabled={loading}
            />
          </div>

          {/* MESSAGE */}
          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Login"}

            {!loading && (
              <span>→</span>
            )}
          </button>
        </form>

        {/* DIVIDER */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* GOOGLE */}
        <button
          className="google-btn"
          type="button"
          onClick={() => {
            setMessage(
              "Google login will be available soon."
            );
          }}
        >
          <span>G</span>
          Continue with Google
        </button>

        {/* REGISTER */}
        <p className="auth-switch">
          Don't have an account?{" "}

          <button
            type="button"
            onClick={() =>
              navigate("/register")
            }
          >
            Create account
          </button>
        </p>

      </div>

      {/* FOOTER */}
      <div className="auth-footer">
        © 2026 WebAI. All rights reserved.
      </div>
    </div>
  );
}

export default Login;