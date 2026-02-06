import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Background3D from './Background3D';
import CustomCursor from './CustomCursor';
import LoadingIndicator from './LoadingIndicator';

const Dashboard = ({ user, onLogout }) => {
    const [inputText, setInputText] = useState('');
    const [contentType, setContentType] = useState('Explanation');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('generator');
    const [chatMessages, setChatMessages] = useState(() => {
        const saved = localStorage.getItem('chatMessages');
        return saved ? JSON.parse(saved) : [];
    });
    const [userCredits, setUserCredits] = useState(user.credits || 50000);

    useEffect(() => {
        localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
    }, [chatMessages]);
    const [historyItems, setHistoryItems] = useState([]);
    const [adminStats, setAdminStats] = useState(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRightBarOpen, setIsRightBarOpen] = useState(false);
    const [openCategories, setOpenCategories] = useState({
        educational: true,
        technical: false
    });

    const toggleCategory = (cat) => {
        setOpenCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const fetchHistory = async () => {
        try {
            const response = await axios.get(`http://127.0.0.1:5002/api/history?user_id=${user.id || user.email}`);
            if (response.data.status === 'success') {
                setHistoryItems(response.data.history);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const fetchAdminStats = async () => {
        if (!user || user.email.toLowerCase() !== 'admin@gmail.com') {
            console.log("Access denied: Not admin email", user?.email);
            return;
        }
        try {
            console.log("Fetching admin stats for:", user.email);
            const response = await axios.get(`http://127.0.0.1:5002/api/admin/stats?admin_email=${user.email}`);
            console.log("Admin stats response:", response.data);
            setAdminStats(response.data.daily_logins || []);
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            setAdminStats([]); // Fallback to empty array to show at least the container/error state
        }
    };

    useEffect(() => {
        if (user) {
            fetchHistory();
            if (user.email.toLowerCase() === 'admin@gmail.com') {
                fetchAdminStats();
            }
        }
    }, [user]);

    // Auto-scroll to bottom of response
    useEffect(() => {
        if (chatMessages.length > 0) {
            const scrollArea = document.querySelector('.response-scroll-area');
            if (scrollArea) {
                scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [chatMessages]);



    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || isGenerating) return;

        const currentInput = inputText;
        const currentType = contentType;

        // Add user message to chat
        const userMsg = { id: Date.now(), type: 'user', content: currentInput };
        setChatMessages(prev => [...prev, userMsg]);
        setInputText(''); // Clear input immediately for better UX
        setIsGenerating(true);

        try {
            const response = await axios.post('http://127.0.0.1:5002/api/generate', {
                topic: currentInput,
                content_type: currentType,
                user_id: user.id || user.email
            });

            if (response.data.content) {
                const aiMsg = {
                    id: Date.now() + 1,
                    type: 'ai',
                    content: response.data.content,
                    contentType: currentType,
                    topic: currentInput
                };
                setChatMessages(prev => [...prev, aiMsg]);
                setUserCredits(response.data.credits_left);
                fetchHistory(); // Refresh history
            }

        } catch (error) {
            console.error('Generation error:', error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to generate content";
            const errAiMsg = { id: Date.now() + 1, type: 'error', content: `❌ Error: ${errorMsg}` };
            setChatMessages(prev => [...prev, errAiMsg]);
        } finally {
            setIsGenerating(false);
        }
    };


    const aboutFeatures = [
        { title: "AI-Powered", description: "Harness cutting-edge artificial intelligence to generate high-quality content in seconds", icon: "🤖" },
        { title: "Lightning Fast", description: "Get instant results without waiting. Our optimized algorithms deliver speed you can count on", icon: "⚡" },
        { title: "Analytics", description: "Track your usage, monitor trends, and optimize your content generation strategy", icon: "📊" },
        { title: "Secure", description: "Your data is encrypted and protected with enterprise-grade security measures", icon: "🔒" },
        { title: "Premium Quality", description: "Every piece of content is crafted with attention to detail and quality standards", icon: "💎" },
        { title: "Always Evolving", description: "We continuously improve our AI models to deliver better results every day", icon: "🚀" }
    ];

    const renderContent = (text) => {
        if (!text) return null;

        const lines = text.split('\n');
        return lines.map((line, i) => {
            if (!line.trim()) return <div key={i} style={{ height: '0.8rem' }}></div>;
            let processedLine = line;

            // Handle Horizontal Rule
            if (processedLine.trim() === '---') {
                return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />;
            }

            // Handle Headers
            if (processedLine.startsWith('### ')) {
                return <h3 key={i} style={{ color: 'var(--accent-cyan)', margin: '1.5rem 0 0.5rem', fontWeight: '700' }}>{processedLine.replace('### ', '')}</h3>;
            }
            if (processedLine.startsWith('## ')) {
                return <h2 key={i} style={{ color: 'var(--accent-cyan)', margin: '1.8rem 0 0.8rem', fontWeight: '700' }}>{processedLine.replace('## ', '')}</h2>;
            }
            if (processedLine.startsWith('# ')) {
                return <h1 key={i} style={{ color: 'var(--accent-cyan)', margin: '2rem 0 1rem', fontWeight: '800' }}>{processedLine.replace('# ', '')}</h1>;
            }

            // Handle Bullet Points
            if (processedLine.startsWith('- ') || processedLine.startsWith('* ')) {
                const content = processedLine.substring(2);
                return (
                    <div key={i} style={{ display: 'flex', gap: '10px', margin: '0.5rem 0 0.5rem 1rem', color: '#e2e8f0' }}>
                        <span>•</span>
                        <div>{renderInline(content)}</div>
                    </div>
                );
            }

            // Handle [TABLE] Block
            if (processedLine.trim() === '[TABLE]') {
                let j = i + 1;
                const rows = [];
                while (j < lines.length && lines[j].trim() !== '[/TABLE]') {
                    if (lines[j].trim()) {
                        rows.push(lines[j].split(',').map(cell => cell.trim()));
                    }
                    j++;
                }

                if (rows.length > 0) {
                    const headers = rows[0];
                    const dataRows = rows.slice(1);
                    return (
                        <div key={i} className="custom-table-container">
                            <table className="custom-app-table">
                                <thead>
                                    <tr>
                                        {headers.map((h, idx) => <th key={idx}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dataRows.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                            {row.map((cell, cIdx) => <td key={cIdx}>{cell}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
            }

            // Skip lines inside [TABLE] block as they are handled above
            let isInsideTable = false;
            let currentLine = i;
            let searchIndex = 0;
            while (searchIndex < currentLine) {
                if (lines[searchIndex].trim() === '[TABLE]') isInsideTable = true;
                if (lines[searchIndex].trim() === '[/TABLE]') isInsideTable = false;
                searchIndex++;
            }
            if (isInsideTable || processedLine.trim() === '[/TABLE]') return null;

            return (
                <p key={i} style={{ margin: '0.8rem 0', color: '#e2e8f0', lineHeight: '1.7' }}>
                    {renderInline(processedLine)}
                </p>
            );
        });
    };

    const renderInline = (text) => {
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = text.split(boldRegex);
        return parts.map((part, index) => {
            return index % 2 === 1 ? <strong key={index} style={{ color: '#fff', fontWeight: '700' }}>{part}</strong> : part;
        });
    };


    return (
        <div className={`dashboard-layout ${isSidebarOpen ? 'sidebar-visible' : ''} ${isRightBarOpen ? 'rightbar-visible' : ''}`}>
            <CustomCursor />

            {/* Navbar */}
            <nav className="navbar">
                <div className="nav-left-group">
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? '✕' : '☰'}
                    </button>
                    <div className="brand">
                        <img src="/logo.png" alt="EduWrite" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                        <h1 className="brand-name">Edu Write</h1>
                        <div className="pro-badge">PRO</div>
                    </div>
                </div>

                <div className="nav-links desktop-only">
                    <button className={`nav-item ${activeTab === 'generator' ? 'active' : ''}`} onClick={() => setActiveTab('generator')}>Generator</button>
                    <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); setIsSidebarOpen(true); }}>History</button>
                    <button className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
                    <button className={`nav-item ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About</button>
                </div>

                <div className="nav-right">
                    <button className="mobile-menu-btn right-toggle" onClick={() => setIsRightBarOpen(!isRightBarOpen)}>⚙️</button>
                    <div className="user-pill desktop-only">
                        <div className="user-avatar">{user.email[0].toUpperCase()}</div>
                        <span style={{ fontSize: '0.9rem' }}>{user.email.split('@')[0]}</span>
                    </div>
                    <button className="exit-btn" onClick={onLogout}>🚪 <span className="desktop-only">Logout</span></button>
                </div>
            </nav>

            {/* Left Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-mobile-header">
                    <h3>Menu</h3>
                    <button onClick={() => setIsSidebarOpen(false)}>✕</button>
                </div>

                <button className="new-chat-btn" onClick={() => { setActiveTab('generator'); setIsSidebarOpen(false); setChatMessages([]); localStorage.removeItem('chatMessages'); setInputText(''); }}>
                    New Chat
                </button>



                <div>
                    <h3 className="sidebar-label">Chat History</h3>
                    <div className="chat-history">
                        {historyItems.length > 0 ? historyItems.map((item) => (
                            <div key={item.id} className="history-item" onClick={() => {
                                setChatMessages([{
                                    id: item.id,
                                    type: 'ai',
                                    content: item.response,
                                    topic: item.topic,
                                    contentType: item.content_type
                                }]);
                                setIsSidebarOpen(false);
                                setActiveTab('generator');
                            }}>
                                <span className="icon">💬</span> {item.topic || item.title}
                            </div>

                        )) : (
                            <div className="history-item empty">No history yet</div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content" onClick={() => { setIsSidebarOpen(false); setIsRightBarOpen(false); }}>
                <div className="tab-content-wrapper" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'generator' ? (
                        <div className="response-scroll-area">
                            {chatMessages.length === 0 ? (
                                <div className="welcome-center">
                                    <h2>Welcome, <span>{user.email.split('@')[0]}</span></h2>
                                    <p>Ask anything to generate <span className="cyan-text">{contentType}</span> with AI</p>
                                </div>
                            ) : (
                                <div className="chat-sequence">
                                    {chatMessages.map((msg) => (
                                        <div key={msg.id} className={`message-item ${msg.type}`}>
                                            {msg.type === 'user' ? (
                                                <div className="user-query-bubble">
                                                    <span className="user-icon">👤</span>
                                                    <p>{msg.content}</p>
                                                </div>
                                            ) : (
                                                <div className="response-display chat-ai-response">
                                                    <div className="response-header">
                                                        <span className="type-badge">{msg.contentType}</span>
                                                        <h3 className="topic-title">{msg.topic}</h3>
                                                    </div>
                                                    <div className="response-body markdown-content">
                                                        {renderContent(msg.content)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {isGenerating && (
                                        <div className="ai-loading-indicator">
                                            <LoadingIndicator size={120} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    ) : activeTab === 'history' ? (
                        <div className="response-scroll-area">
                            <h2 className="section-title">Generation History</h2>
                            {historyItems.length > 0 ? (
                                <div className="history-grid">
                                    {historyItems.map((item) => (
                                        <div key={item.id} className="history-card" onClick={() => {
                                            setChatMessages([{
                                                id: item.id,
                                                type: 'ai',
                                                content: item.response,
                                                topic: item.topic,
                                                contentType: item.content_type
                                            }]);
                                            setActiveTab('generator');
                                        }}>
                                            <div className="history-card-header">
                                                <span className="type-badge">{item.content_type}</span>
                                                <span className="history-card-date">{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="history-card-topic">{item.topic}</div>
                                        </div>

                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <span>📊</span>
                                    <p>Your history is empty. Start generating!</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'activity' ? (
                        <div className="response-scroll-area">
                            <h2 className="section-title">Your Activity</h2>
                            <div className="activity-stats">
                                <div className="stat-card">
                                    <div className="stat-value">Unlimited</div>
                                    <div className="stat-label">Credits Remaining</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-value">{historyItems.length}</div>
                                    <div className="stat-label">Total Generations</div>
                                </div>
                                {user.email.toLowerCase() === 'admin@gmail.com' && (
                                    <div className="admin-stats-container">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <h3 className="admin-stats-title" style={{ margin: 0 }}>Daily User Logins</h3>
                                            <button
                                                onClick={fetchAdminStats}
                                                className="refresh-btn"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '6px' }}
                                            >
                                                🔄 Refresh
                                            </button>
                                        </div>
                                        {adminStats && adminStats.length > 0 ? (
                                            <div className="admin-stats-list">
                                                {adminStats.map((stat, idx) => (
                                                    <div key={idx} className="admin-stat-row">
                                                        <span className="stat-day">{new Date(stat.day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                                        <span className="stat-count">{stat.count} accounts</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ textAlign: 'center', opacity: 0.6, padding: '1rem' }}>
                                                {adminStats ? "No login records found for the past week." : "Loading admin statistics..."}
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="stat-card">
                                    <div className="stat-value">Active</div>
                                    <div className="stat-label">Account Status</div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'about' ? (
                        <div className="about-container">
                            <div className="about-header">
                                <h2 className="greeting-text">Hello, <span className="cyan-text">{user.name || user.email.split('@')[0]}!</span></h2>
                                <h1>About <span className="cyan-text">Edu Write</span></h1>
                                <p className="tagline">Transforming Education with <span className="purple-text">Intelligent Content Generation</span></p>
                            </div>
                            <div className="about-content">
                                <h2 className="section-title">Why Choose Edu Write?</h2>
                                <div className="features-grid">
                                    {aboutFeatures.map((feature, index) => (
                                        <div key={index} className="feature-card">
                                            <div className="feature-icon">{feature.icon}</div>
                                            <div className="feature-info"><h3>{feature.title}</h3><p>{feature.description}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {activeTab !== 'about' && (
                    <div className="input-section-bottom">
                        <div className="credits-info" style={{ justifyContent: 'center' }}>
                            <span>⚡</span> Credits: <span className="credits-count">Unlimited</span>
                        </div>

                        <div className="input-container">
                            <form onSubmit={handleGenerate} className="chat-input-wrapper">
                                <input
                                    type="text"
                                    className="chat-input"
                                    placeholder={`Ask about something for ${contentType}...`}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={isGenerating}
                                />
                                <button type="submit" className="send-btn" disabled={isGenerating || !inputText.trim()}>
                                    {isGenerating ? <div className="loader-small"></div> : <span style={{ color: '#000' }}>→</span>}
                                </button>
                            </form>
                        </div>
                        <div className="footer-note">Created by <span>● ✨ AI Student</span></div>
                    </div>
                )}
            </main>



            {/* Right Sidebar */}
            <aside className={`right-bar ${isRightBarOpen ? 'open' : ''}`}>
                <div className="sidebar-mobile-header"><h3>Options</h3><button onClick={() => setIsRightBarOpen(false)}>✕</button></div>
                <div className="sidebar-section">
                    <h3 className="sidebar-label">Content Types</h3>
                    <div className="category-wrapper">
                        <div className="category-header smaller" onClick={() => toggleCategory('educational')}>
                            <span>Educational</span><span className={`chevron ${openCategories.educational ? 'open' : ''}`}>▼</span>
                        </div>
                        <div className="category-content" style={{ maxHeight: openCategories.educational ? '500px' : '0' }}>
                            {['Explanation', 'Summary', 'Quiz', 'Interactive Lesson', 'Mind Map'].map(type => (
                                <div key={type} className={`content-type-item small ${contentType === type ? 'active' : ''}`} onClick={() => { setContentType(type); setActiveTab('generator'); setIsRightBarOpen(false); }}>
                                    <span className="dot"></span>
                                    {type}
                                </div>
                            ))}
                        </div>

                    </div>
                    <div className="category-wrapper">
                        <div className="category-header smaller" onClick={() => toggleCategory('technical')}>
                            <span>Technical</span><span className={`chevron ${openCategories.technical ? 'open' : ''}`}>▼</span>
                        </div>
                        <div className="category-content" style={{ maxHeight: openCategories.technical ? '500px' : '0' }}>
                            {['Coding', 'Research Paper'].map(type => (
                                <div key={type} className={`content-type-item small ${contentType === type ? 'active' : ''}`} onClick={() => { setContentType(type); setActiveTab('generator'); setIsRightBarOpen(false); }}>
                                    <span className="dot"></span>
                                    {type}
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </aside>
            {(isSidebarOpen || isRightBarOpen) && <div className="mobile-overlay" onClick={() => { setIsSidebarOpen(false); setIsRightBarOpen(false); }}></div>}
        </div>
    );
};

export default Dashboard;
