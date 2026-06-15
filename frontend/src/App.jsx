import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Server,
  Settings,
  Search,
  Calendar,
  Utensils,
  BookOpen,
  User,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  GraduationCap,
  Sparkles
} from "lucide-react";

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5001"
  : "";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Student Personalization State (loaded from localStorage or defaults)
  const [personalization, setPersonalization] = useState(() => {
    const saved = localStorage.getItem("campus_personalization");
    return saved ? JSON.parse(saved) : {
      name: "Marcus Vance",
      passedCourses: ["CS101", "MATH150"],
      diet: "None"
    };
  });

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState({
    library: { bookCount: 0, checkedOutCount: 0, sampleBooks: [] },
    cafeteria: { specials: [], diningHalls: ["north-hall", "south-hall", "quad-commons"] },
    events: { upcomingCount: 0, highlightedEvent: null },
    academics: { courseCount: 6, requirements: "120 credits total" }
  });
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Server Monitor State
  const [servers, setServers] = useState({});
  const [serversLoading, setServersLoading] = useState(true);
  const [restartingKey, setRestartingKey] = useState(null);

  // Chat Panel State
  const [messages, setMessages] = useState([
    {
      sender: "assistant",
      text: `Hi ${personalization.name}! I am your Campus Intelligence AI Assistant. I query individual campus MCP servers (Library, Cafeteria, Events, Academics) in real-time to answer your questions.\n\nTry asking me:\n- *"What's on the menu at South Dining Hall today?"*\n- *"Can I take Web App Dev (CS301) next term?"*\n- *"What workshops are hosted by the GDSC?"*`
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [toolLogs, setToolLogs] = useState([]); // List of tools executed in current session

  // Mini Interactive Tools in Dashboard Widgets
  const [libQuery, setLibQuery] = useState("");
  const [libSearchResults, setLibSearchResults] = useState([]);
  const [libSearching, setLibSearching] = useState(false);
  
  const [selectedHall, setSelectedHall] = useState("north-hall");
  const [hallMenu, setHallMenu] = useState(null);
  const [hallLoading, setHallLoading] = useState(false);

  const [eventsList, setEventsList] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [registrationMsg, setRegistrationMsg] = useState("");

  const [prereqCourse, setPrereqCourse] = useState("CS201");
  const [prereqResult, setPrereqResult] = useState(null);
  const [prereqChecking, setPrereqChecking] = useState(false);

  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch initial dashboard and server monitor data
  useEffect(() => {
    fetchDashboardData();
    fetchServersData();
  }, []);

  // Sync menu display when hall changes
  useEffect(() => {
    fetchHallMenu(selectedHall);
  }, [selectedHall]);

  const fetchDashboardData = async () => {
    try {
      setDashboardLoading(true);
      const res = await fetch(`${API_BASE}/api/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchServersData = async () => {
    try {
      setServersLoading(true);
      const res = await fetch(`${API_BASE}/api/servers`);
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (e) {
      console.error("Error fetching servers data:", e);
    } finally {
      setServersLoading(false);
    }
  };

  const restartServer = async (key) => {
    try {
      setRestartingKey(key);
      const res = await fetch(`${API_BASE}/api/servers/${key}/restart`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setServers(prev => ({
          ...prev,
          [key]: { ...prev[key], status: data.status, error: null }
        }));
        // Refresh dashboard statistics as well
        fetchDashboardData();
      }
    } catch (e) {
      console.error(`Error restarting server ${key}:`, e);
    } finally {
      setRestartingKey(null);
    }
  };

  // Mini Widget Interactivity
  const handleLibrarySearch = async (e) => {
    e.preventDefault();
    if (!libQuery.trim()) return;
    try {
      setLibSearching(true);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Search library books for "${libQuery}"`,
          personalization
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Extract the result from logs if available
        const log = data.logs.find(l => l.tool === "search_books");
        if (log) {
          setLibSearchResults(JSON.parse(log.resultText));
        } else {
          setLibSearchResults([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLibSearching(false);
    }
  };

  const fetchHallMenu = async (hallKey) => {
    try {
      setHallLoading(true);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `What is on the menu at ${hallKey}?`,
          personalization
        })
      });
      if (res.ok) {
        const data = await res.json();
        const log = data.logs.find(l => l.tool === "get_menu");
        if (log) {
          setHallMenu(JSON.parse(log.resultText));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHallLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      setEventsLoading(true);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "List all events",
          personalization
        })
      });
      if (res.ok) {
        const data = await res.json();
        const log = data.logs.find(l => l.tool === "list_events");
        if (log) {
          setEventsList(JSON.parse(log.resultText));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEventsLoading(false);
    }
  };

  const registerForEvent = async (eventId) => {
    try {
      setRegistrationMsg(`Registering for ${eventId}...`);
      const email = `${personalization.name.toLowerCase().replace(/\s+/g, "")}@university.edu`;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Register for event ${eventId} with email ${email}`,
          personalization
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrationMsg(data.answer);
        loadEvents(); // Reload event list spots
        fetchDashboardData(); // Refresh highlights
      }
    } catch (err) {
      setRegistrationMsg("Error registering.");
      console.error(err);
    }
  };

  const checkPrerequisites = async () => {
    try {
      setPrereqChecking(true);
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Can I take course ${prereqCourse}?`,
          personalization
        })
      });
      if (res.ok) {
        const data = await res.json();
        const log = data.logs.find(l => l.tool === "check_prerequisites");
        if (log) {
          setPrereqResult(JSON.parse(log.resultText));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrereqChecking(false);
    }
  };

  // AI Assistant Chat Submit
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { sender: "user", text: userText }]);
    setInputValue("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          personalization
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: "assistant", text: data.answer }]);
        if (data.logs && data.logs.length > 0) {
          setToolLogs(prev => [...data.logs, ...prev]);
        }
      } else {
        setMessages(prev => [...prev, { sender: "assistant", text: "Error: I couldn't reach the campus gateway server." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: "assistant", text: "Error: The campus backend is offline." }]);
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem("campus_personalization", JSON.stringify(personalization));
    alert("Personalization profile saved successfully!");
    // Refresh menus/prereqs based on new preferences
    fetchDashboardData();
    fetchHallMenu(selectedHall);
    setPrereqResult(null);
  };

  const toggleCoursePassed = (courseId) => {
    setPersonalization(prev => {
      const list = prev.passedCourses.includes(courseId)
        ? prev.passedCourses.filter(c => c !== courseId)
        : [...prev.passedCourses, courseId];
      return { ...prev, passedCourses: list };
    });
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo-section">
            <span className="logo-icon">🎓</span>
            <h1 className="logo-text">Campus Intel</h1>
          </div>
          <nav className="nav-links">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={`nav-item ${activeTab === "assistant" ? "active" : ""}`}
            >
              <MessageSquare size={20} />
              AI Assistant
            </button>
            <button
              onClick={() => setActiveTab("servers")}
              className={`nav-item ${activeTab === "servers" ? "active" : ""}`}
            >
              <Server size={20} />
              MCP Servers
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            >
              <Settings size={20} />
              Personalization
            </button>
          </nav>
        </div>

        <div className="student-badge">
          <div className="student-avatar">
            {personalization.name ? personalization.name.split(" ").map(n => n[0]).join("") : "ST"}
          </div>
          <div className="student-info">
            <span className="student-name">{personalization.name}</span>
            <span className="student-meta">Major: Computer Science</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <h2 className="header-title">
            {activeTab === "dashboard" && "Campus Dashboard Overview"}
            {activeTab === "assistant" && "Embedded AI Campus Assistant"}
            {activeTab === "servers" && "MCP Servers Controller"}
            {activeTab === "settings" && "Student Profile Preferences"}
          </h2>
          <div className="header-actions">
            {activeTab === "dashboard" && (
              <button onClick={fetchDashboardData} className="btn-restart" style={{ width: "auto" }}>
                <RefreshCw size={14} /> Refresh Data
              </button>
            )}
            {activeTab === "servers" && (
              <button onClick={fetchServersData} className="btn-restart" style={{ width: "auto" }}>
                <RefreshCw size={14} /> Check Health
              </button>
            )}
          </div>
        </header>

        {/* Dashboard View */}
        {activeTab === "dashboard" && (
          <div className="page-container">
            {dashboardLoading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
                <RefreshCw className="typing-dot" style={{ animation: "spin 2s linear infinite" }} />
                <p style={{ marginTop: "12px" }}>Connecting to MCP Servers and loading live stats...</p>
              </div>
            ) : (
              <div className="dashboard-grid">
                {/* Library Card */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-container">
                      <BookOpen className="card-icon" />
                      <h3>Library Catalog</h3>
                    </div>
                    <span className="card-badge info">Exposed via Library MCP</span>
                  </div>
                  <div style={{ display: "flex", gap: "24px" }}>
                    <div>
                      <div className="stat-large">{dashboardData.library.bookCount}</div>
                      <div className="stat-desc">Total cataloged books</div>
                    </div>
                    <div>
                      <div className="stat-large" style={{ color: "var(--accent-purple)" }}>
                        {dashboardData.library.checkedOutCount}
                      </div>
                      <div className="stat-desc">Currently checked out</div>
                    </div>
                  </div>
                  
                  {/* Library Search interactive widget */}
                  <form onSubmit={handleLibrarySearch} style={{ marginTop: "20px", display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Search books (e.g. 'clean code', 'calculus')..."
                      value={libQuery}
                      onChange={(e) => setLibQuery(e.target.value)}
                    />
                    <button type="submit" className="btn-send" style={{ height: "44px", width: "44px" }}>
                      <Search size={18} />
                    </button>
                  </form>
                  {libSearching && <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "6px" }}>Searching library database...</p>}
                  {libSearchResults.length > 0 && (
                    <div className="list-container" style={{ maxHeight: "150px", overflowY: "auto" }}>
                      {libSearchResults.map(b => (
                        <div key={b.id} className="list-item-custom" style={{ borderLeftColor: "var(--accent-cyan)" }}>
                          <div>
                            <div className="list-item-title">{b.title}</div>
                            <div className="list-item-subtitle">{b.author} | {b.location}</div>
                          </div>
                          <span className={`card-badge ${b.status === "Available" ? "success" : "info"}`}>{b.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cafeteria Card */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-container">
                      <Utensils className="card-icon" />
                      <h3>Dining Specials</h3>
                    </div>
                    <span className="card-badge info">Exposed via Cafeteria MCP</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {dashboardData.cafeteria.specials.map((s, idx) => (
                      <div key={idx} style={{ fontSize: "0.9rem" }}>
                        <span style={{ fontWeight: "600", color: "var(--accent-cyan)" }}>{s.hall}</span>: {s.special}
                      </div>
                    ))}
                  </div>

                  {/* Dining menu toggle */}
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                      {dashboardData.cafeteria.diningHalls.map(hall => (
                        <button
                          key={hall}
                          onClick={() => setSelectedHall(hall)}
                          className={`btn-restart ${selectedHall === hall ? "active" : ""}`}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.75rem",
                            borderColor: selectedHall === hall ? "var(--accent-cyan)" : "var(--glass-border)",
                            color: selectedHall === hall ? "var(--accent-cyan)" : "var(--text-primary)"
                          }}
                        >
                          {hall === "north-hall" ? "North" : hall === "south-hall" ? "South" : "Quad"}
                        </button>
                      ))}
                    </div>
                    {hallLoading ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Loading menus...</p>
                    ) : hallMenu ? (
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "10px", fontSize: "0.8rem" }}>
                        <div style={{ marginBottom: "6px" }}>
                          <strong>Lunch Special:</strong> {hallMenu.lunch.map(m => m.item).slice(0,2).join(", ")}
                        </div>
                        <div>
                          <strong>Dinner Special:</strong> {hallMenu.dinner.map(m => m.item).slice(0,2).join(", ")}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Events Card */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-container">
                      <Calendar className="card-icon" />
                      <h3>Upcoming Events</h3>
                    </div>
                    <span className="card-badge info">Exposed via Events MCP</span>
                  </div>
                  
                  {dashboardData.events.highlightedEvent && (
                    <div className="event-hero">
                      <div className="event-hero-title">{dashboardData.events.highlightedEvent.title}</div>
                      <div className="list-item-subtitle">Hosted by {dashboardData.events.highlightedEvent.host}</div>
                      <div className="event-details">
                        <span>📅 {dashboardData.events.highlightedEvent.date}</span>
                        <span>⏰ {dashboardData.events.highlightedEvent.time}</span>
                        <span>📍 {dashboardData.events.highlightedEvent.location}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button onClick={loadEvents} className="btn-restart" style={{ width: "auto" }}>
                      <Calendar size={14} /> View All Events ({dashboardData.events.upcomingCount})
                    </button>
                    {eventsLoading && <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Fetching...</p>}
                  </div>

                  {eventsList.length > 0 && (
                    <div className="list-container" style={{ maxHeight: "200px", overflowY: "auto", marginTop: "16px" }}>
                      {eventsList.map(e => (
                        <div key={e.id} className="list-item-custom" style={{ borderLeftColor: "var(--accent-green)" }}>
                          <div>
                            <div className="list-item-title">{e.title}</div>
                            <div className="list-item-subtitle">{e.date} | Spots left: {e.spotsLeft}</div>
                          </div>
                          <button
                            onClick={() => registerForEvent(e.id)}
                            className="btn-restart"
                            style={{ width: "auto", padding: "4px 8px", fontSize: "0.75rem" }}
                            disabled={e.spotsLeft <= 0}
                          >
                            Register
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {registrationMsg && (
                    <div style={{ fontSize: "0.8rem", padding: "8px", background: "rgba(0,242,254,0.05)", borderRadius: "8px", marginTop: "8px", border: "1px solid rgba(0,242,254,0.1)" }}>
                      {registrationMsg}
                    </div>
                  )}
                </div>

                {/* Academics Card */}
                <div className="dashboard-card">
                  <div className="card-header-row">
                    <div className="card-title-container">
                      <GraduationCap className="card-icon" />
                      <h3>Academic Check</h3>
                    </div>
                    <span className="card-badge info">Exposed via Academics MCP</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                    Verify course registration prerequisites dynamically. Results are computed live based on your completed coursework.
                  </p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <select
                      className="form-select"
                      style={{ padding: "8px", borderRadius: "10px", flexGrow: 1 }}
                      value={prereqCourse}
                      onChange={(e) => setPrereqCourse(e.target.value)}
                    >
                      <option value="CS201">CS201 - Data Structures</option>
                      <option value="CS301">CS301 - Web App Dev</option>
                      <option value="CS401">CS401 - Artificial Intelligence</option>
                      <option value="MATH220">MATH220 - Linear Algebra</option>
                    </select>
                    <button onClick={checkPrerequisites} className="btn-restart" style={{ width: "auto", padding: "0 16px" }}>
                      Check
                    </button>
                  </div>

                  {prereqChecking && <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Verifying academic constraints...</p>}
                  {prereqResult && (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "12px",
                        background: prereqResult.eligible ? "rgba(57, 255, 20, 0.05)" : "rgba(255, 56, 56, 0.05)",
                        border: `1px solid ${prereqResult.eligible ? "rgba(57, 255, 20, 0.15)" : "rgba(255, 56, 56, 0.15)"}`,
                        fontSize: "0.85rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", marginBottom: "4px" }}>
                        {prereqResult.eligible ? (
                          <span style={{ color: "var(--accent-green)" }}>🟢 Eligible to enroll</span>
                        ) : (
                          <span style={{ color: "var(--accent-red)" }}>🔴 Missing prerequisites</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Required: {prereqResult.prerequisitesRequired.length > 0 ? prereqResult.prerequisitesRequired.join(", ") : "None"}
                      </div>
                      {!prereqResult.eligible && (
                        <div style={{ fontSize: "0.75rem", color: "var(--accent-red)", marginTop: "4px" }}>
                          Prerequisites needed: {prereqResult.missingPrerequisites.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant View */}
        {activeTab === "assistant" && (
          <div className="page-container" style={{ padding: "16px 32px" }}>
            <div className="chat-layout">
              {/* Chat Panel */}
              <div className="chat-panel">
                <div className="chat-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={18} style={{ color: "var(--accent-cyan)" }} />
                    <strong style={{ fontSize: "0.95rem" }}>AI Assistant Router</strong>
                  </div>
                  <div className="chat-status">
                    <div className="indicator-dot" style={{ backgroundColor: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
                    <span>Live MCP Session</span>
                  </div>
                </div>

                <div className="chat-history">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`message-row ${m.sender}`}>
                      <div className="message-bubble">
                        {/* Display simple formatting */}
                        {m.text.split("\n").map((line, lIdx) => {
                          if (line.startsWith("### ")) {
                            return <h3 key={lIdx}>{line.replace("### ", "")}</h3>;
                          }
                          if (line.startsWith("#### ")) {
                            return <h4 key={lIdx}>{line.replace("#### ", "")}</h4>;
                          }
                          if (line.startsWith("- ")) {
                            return <li key={lIdx} style={{ marginLeft: "12px", listStyleType: "square" }}>{line.replace("- ", "")}</li>;
                          }
                          return <p key={lIdx} style={{ margin: "2px 0" }}>{line}</p>;
                        })}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="message-row assistant">
                      <div className="message-bubble" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="typing-indicator">
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                          <span className="typing-dot"></span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Querying MCP servers...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="chat-input-row">
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask about cafeteria menus, library catalog search, course prerequisites..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button type="submit" className="btn-send" disabled={chatLoading}>
                    <Send size={18} />
                  </button>
                </form>
              </div>

              {/* Tool Execution Logs Panel */}
              <div className="trail-panel">
                <div className="trail-header">
                  <Server size={16} />
                  <span>Real-time Routing Logs</span>
                </div>
                <div className="trail-list">
                  {toolLogs.length === 0 ? (
                    <div className="trail-empty">
                      No tools executed in this session. Ask the assistant a question to stream JSON-RPC logs!
                    </div>
                  ) : (
                    toolLogs.map((log, index) => (
                      <div key={index} className="trail-item">
                        <div className="trail-item-header">
                          <span className={`trail-badge ${log.server}`}>
                            {log.server}
                          </span>
                          <span className="trail-tool-name">{log.tool}</span>
                        </div>
                        <div className="trail-args">
                          <strong>Arguments:</strong>
                          <pre style={{ fontSize: "0.75rem", overflowX: "auto" }}>
                            {JSON.stringify(log.arguments, null, 2)}
                          </pre>
                        </div>
                        <div className="trail-result">
                          <strong>Response:</strong>
                          <pre style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                            {log.resultText}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MCP Servers View */}
        {activeTab === "servers" && (
          <div className="page-container">
            {serversLoading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
                <RefreshCw className="typing-dot" style={{ animation: "spin 2s linear infinite" }} />
                <p style={{ marginTop: "12px" }}>Connecting to MCP daemon...</p>
              </div>
            ) : (
              <div>
                <div className="server-grid">
                  {Object.entries(servers).map(([key, config]) => (
                    <div key={key} className={`server-card ${config.status === "Online" ? "online" : config.status === "Error" ? "error" : ""}`}>
                      <div className="server-header">
                        <span className="server-name-lbl">{config.name}</span>
                        <div className="status-indicator">
                          <span className="indicator-dot"></span>
                          <span>{config.status}</span>
                        </div>
                      </div>

                      <div className="server-details-list">
                        <div><strong>Process:</strong> Node stdio Subprocess</div>
                        <div><strong>Path:</strong> .../{config.path.split(/[\\/]/).slice(-3).join("/")}</div>
                        {config.error && <div style={{ color: "var(--accent-red)", wordBreak: "break-all" }}><strong>Error:</strong> {config.error}</div>}
                      </div>

                      <div className="server-tools-box">
                        <div className="tools-title">Registered Tools</div>
                        <div className="tool-badge-list">
                          {config.tools.map(tool => (
                            <span key={tool.name} className="tool-badge" title={tool.description}>
                              {tool.name}
                            </span>
                          ))}
                          {config.tools.length === 0 && <span className="tool-badge" style={{ color: "var(--text-muted)" }}>None</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => restartServer(key)}
                        className="btn-restart"
                        disabled={restartingKey === key}
                      >
                        <RefreshCw size={14} className={restartingKey === key ? "typing-dot" : ""} />
                        {restartingKey === key ? "Restarting..." : "Restart Server"}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="dashboard-card" style={{ gridColumn: "span 12" }}>
                  <h3>Model Context Protocol (MCP) Information</h3>
                  <p style={{ marginTop: "10px", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    Each of the modules above is an independent Node.js process exposing its schemas and actions via the standard **Model Context Protocol**. 
                    Our Express gateway acts as the **MCP Client**, spawning these servers as child processes and routing natural language intents. 
                    No centralized campus database exists. Data is parsed and returned live by the respective server.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personalization View */}
        {activeTab === "settings" && (
          <div className="page-container">
            <div className="settings-box">
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Student Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={personalization.name}
                    onChange={(e) => setPersonalization(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dietary Restrictions</label>
                  <select
                    className="form-select"
                    value={personalization.diet}
                    onChange={(e) => setPersonalization(prev => ({ ...prev, diet: e.target.value }))}
                  >
                    <option value="None">No restrictions</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Completed Courses (For Prerequisite Checks)</label>
                  <div className="checkbox-group">
                    {[
                      { id: "CS101", title: "CS101 - Intro to CS" },
                      { id: "CS201", title: "CS201 - Data Structures" },
                      { id: "CS301", title: "CS301 - Web Application" },
                      { id: "MATH150", title: "MATH150 - Calculus I" },
                      { id: "MATH220", title: "MATH220 - Linear Algebra" }
                    ].map(course => {
                      const checked = personalization.passedCourses.includes(course.id);
                      return (
                        <div
                          key={course.id}
                          onClick={() => toggleCoursePassed(course.id)}
                          className={`checkbox-item ${checked ? "checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            style={{ pointerEvents: "none" }}
                          />
                          <span style={{ fontSize: "0.85rem" }}>{course.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="btn-save">
                  Save Personalization Profile
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
