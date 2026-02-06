import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const Login = ({ onLoginSuccess }) => {
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [view, setView] = useState('login'); // 'login' or 'forgot'

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true);
            setError(null);
            try {
                // Send access_token to backend for verification and user sync
                const response = await axios.post('http://127.0.0.1:5002/api/auth/google', {
                    access_token: tokenResponse.access_token
                });

                if (response.data.status === 'success') {
                    const userData = response.data.user;
                    if (onLoginSuccess) {
                        onLoginSuccess(userData);
                    }
                } else {
                    setError('Backend authentication failed.');
                }
            } catch (err) {
                console.error('Error during Google login:', err);
                setError(err.response?.data?.error || 'Failed to authenticate with Google.');
            } finally {
                setLoading(false);
            }
        },
        onError: () => {
            console.error('Login Failed');
            setError('Google login failed. Please try again.');
        }
    });

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await axios.post('http://127.0.0.1:5002/api/auth/email', {
                email: email,
                password: password
            });

            if (response.data.status === 'success') {
                onLoginSuccess(response.data.user);
            } else {
                setError('Authentication failed.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to sign in.');
        } finally {
            setLoading(false);
        }
    };


    const handleForgotPassword = (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Mock sending OTP
        setTimeout(() => {
            setLoading(false);
            setSuccessMsg(`OTP has been sent to ${email}`);
        }, 1500);
    };

    return (
        <div className="login-container">
            <div className="three-d-bg">
                <div className="cosmic-stars">
                    {[...Array(50)].map((_, i) => (
                        <div key={i} className="star" style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`
                        }}></div>
                    ))}
                </div>
                <div className="nebula-wrapper">
                    <div className="nebula nebula-cyan"></div>
                    <div className="nebula nebula-purple"></div>
                </div>
                <div className="shooting-stars">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="shooting-star" style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 40}%`,
                            animationDelay: `${Math.random() * 10}s`
                        }}></div>
                    ))}
                </div>
                <div className="cube-wrapper">
                    <div className="cube cube-1"></div>
                    <div className="cube cube-2"></div>
                    <div className="cube cube-3"></div>
                </div>
                <div className="floating-nodes">
                    {[...Array(15)].map((_, i) => (
                        <div key={i} className="node" style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            animationDuration: `${10 + Math.random() * 15}s`
                        }}></div>
                    ))}
                </div>
            </div>

            <div className="login-card">

                <div className="login-header">
                    <div style={{ marginBottom: '1.5rem' }}>
                        <img
                            src="/logo.png"
                            alt="EduWrite Logo"
                            style={{ width: '120px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(0, 210, 255, 0.5))' }}
                        />
                    </div>
                    <h1>{view === 'login' ? 'Welcome To EduWrite' : 'Reset Password'}</h1>
                    <p>{view === 'login' ? 'Sign in to continue to Edu Write' : 'Enter your email to receive an OTP'}</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {successMsg && <div className="success-message">{successMsg}</div>}

                {view === 'login' ? (
                    <>
                        <form className="login-form" onSubmit={handleEmailLogin}>
                            <div className="input-group">
                                <label>Email Address*</label>
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label>Password*</label>
                                    <span
                                        className="forgot-link"
                                        onClick={() => { setView('forgot'); setError(null); setSuccessMsg(null); }}
                                    >
                                        Forgot Password?
                                    </span>
                                </div>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="login-btn">Sign In</button>
                        </form>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Or continue with</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        </div>

                        <button
                            className="custom-google-btn"
                            onClick={() => login()}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="custom-loader"></div>
                            ) : (
                                <>
                                    <img src="/google_icon.png" alt="Google" className="google-icon-img" />
                                    <span>Sign in with Google</span>
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <form className="login-form" onSubmit={handleForgotPassword}>
                        <div className="input-group">
                            <label>Email Address*</label>
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <span
                                className="forgot-link"
                                onClick={() => { setView('login'); setError(null); setSuccessMsg(null); }}
                            >
                                Back to Login
                            </span>
                        </div>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Secure login with Google OAuth 2.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
