import React, { useState } from 'react';
import { Lock, User, ArrowRight } from 'lucide-react';
import { loginUser } from '../services/api';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await loginUser(username, password);
      if (response.success) {
        onLogin();
      } else {
        // If login failed, show the message
        setError(response.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error. Please make sure the backend server was restarted!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style>{`
        .login-wrapper {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top left, #1e40af 0%, #0f172a 100%);
          font-family: 'Inter', system-ui, sans-serif;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 3rem 2.5rem;
          border-radius: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
          width: 100%;
          max-width: 420px;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(30px);
        }

        @keyframes slideUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-icon-wrap {
          width: 72px;
          height: 72px;
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem auto;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
          color: white;
          transform: rotate(-5deg);
          transition: transform 0.3s ease;
        }

        .login-card:hover .login-icon-wrap {
          transform: rotate(0deg) scale(1.05);
        }

        .login-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          text-align: center;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          color: #64748b;
          text-align: center;
          font-size: 0.95rem;
          margin: 0 0 2.5rem 0;
        }

        .input-group {
          margin-bottom: 1.5rem;
          position: relative;
        }

        .input-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-icon {
          position: absolute;
          top: 38px;
          left: 14px;
          color: #94a3b8;
          transition: color 0.3s ease;
        }

        .login-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.75rem;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #f8fafc;
          color: #0f172a;
          box-sizing: border-box;
        }

        .login-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .login-input:focus + .input-icon,
        .input-group:focus-within .input-icon {
          color: #3b82f6;
        }

        .error-msg {
          background: #fef2f2;
          color: #ef4444;
          padding: 0.85rem;
          border-radius: 12px;
          font-size: 0.9rem;
          text-align: center;
          margin-bottom: 1.5rem;
          border: 1px solid #fecaca;
          font-weight: 500;
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }

        .login-btn {
          width: 100%;
          padding: 1rem;
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px 0 rgba(15, 23, 42, 0.39);
        }

        .login-btn:hover:not(:disabled) {
          background: #1e293b;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.23);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .login-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>

      <div className="login-card">
        <div className="text-center">
          <div className="login-icon-wrap">
            <Lock size={36} strokeWidth={2.5} />
          </div>
          <h2 className="login-title">Srinivasa Billing</h2>
          <p className="login-subtitle">Sign in to access your dashboard</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="login-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <User className="input-icon" size={20} />
          </div>

          <div className="input-group" style={{ marginBottom: '2rem' }}>
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Lock className="input-icon" size={20} />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : (
              <>
                Sign In <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
