import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../App.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();

    setMessage("");

    if (!name || !email || !password || !confirmPassword) {
      setMessage("সবগুলো ঘর পূরণ করুন।");
      return;
    }

    if (password.length < 6) {
      setMessage("Password কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Password দুটো একই নয়।");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Account তৈরি হয়েছে। আপনার email inbox চেক করুন।"
    );

    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo">
          <span>✦</span>
          WebAI
        </div>

        <div className="auth-heading">
          <h1>Create your account</h1>

          <p>
            Start building amazing websites with AI.
          </p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleRegister}
        >

          <div className="input-group">

            <label>Full Name</label>

            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

          </div>


          <div className="input-group">

            <label>Email</label>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

          </div>


          <div className="input-group">

            <label>Password</label>

            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

          </div>


          <div className="input-group">

            <label>Confirm Password</label>

            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
            />

          </div>


          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}


          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <span>→</span>}
          </button>

        </form>


        <div className="auth-divider">
          <span>or</span>
        </div>


        <button className="google-btn" type="button">
          <span>G</span>
          Continue with Google
        </button>


        <p className="auth-switch">
          Already have an account?

          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Login
          </button>
        </p>

      </div>


      <div className="auth-footer">
        © 2026 WebAI. All rights reserved.
      </div>

    </div>
  );
}

export default Register;