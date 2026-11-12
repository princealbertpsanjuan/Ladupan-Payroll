import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/ladupan-logo.png";
import Spinner from "../../components/Spinner";
import "../../styles/auth.css";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const user = await login(email, password);

      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/client/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
      // New key replays the shake on every failed attempt
      setErrorKey((key) => key + 1);
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="Ladupan Logo" className="login-logo" />

        <h1>Ladupan Payroll</h1>
        <p>Daily Time Record Management System</p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email address"
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

          {error && (
            <span key={errorKey} className="login-error" role="alert">
              {error}
            </span>
          )}

          <button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;