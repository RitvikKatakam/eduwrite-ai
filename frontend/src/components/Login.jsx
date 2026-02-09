import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL;

const Login = ({ onLoginSuccess }) => {
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState("login");

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.post(
          `${API_BASE}/api/auth/google`,
          { access_token: tokenResponse.access_token },
          { withCredentials: true }
        );

        if (response.data?.status === "success") {
          onLoginSuccess(response.data.user);
        } else {
          setError("Google authentication failed.");
        }
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.error ||
          "Unable to authenticate with Google."
        );
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError("Google login failed. Please try again.");
    }
  });

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/email`,
        { email, password },
        { withCredentials: true }
      );

      if (response.data?.status === "success") {
        onLoginSuccess(response.data.user);
      } else {
        setError("Invalid credentials.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        "Email login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(`OTP sent to ${email}`);
    }, 1500);
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="login-header">
          <img src="/logo.png" alt="EduWrite" width="120" />
          <h1>{view === "login" ? "Welcome To EduWrite" : "Reset Password"}</h1>
          <p>
            {view === "login"
              ? "Sign in to continue"
              : "Enter your email to receive an OTP"}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        {view === "login" ? (
          <>
            <form className="login-form" onSubmit={handleEmailLogin}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <span
                className="forgot-link"
                onClick={() => setView("forgot")}
              >
                Forgot Password?
              </span>
            </form>

            <button
              className="custom-google-btn"
              onClick={login}
              disabled={loading}
            >
              {loading ? "Connecting..." : "Sign in with Google"}
            </button>
          </>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">
              {loading ? "Sending..." : "Send OTP"}
            </button>
            <span onClick={() => setView("login")}>
              Back to Login
            </span>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
