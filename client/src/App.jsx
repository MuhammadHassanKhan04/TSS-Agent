import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Users,
  MessageSquare,
  BookOpen,
  Settings as SettingsIcon,
  Send,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Phone,
  Calendar,
  DollarSign
} from 'lucide-react';

// Backend URL: set VITE_API_URL in Vercel env vars to point to your Railway backend
// e.g. VITE_API_URL=https://tss-agent.up.railway.app
const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:5000' : '');
const WS_BASE = import.meta.env.VITE_WS_URL || (window.location.port === '5173' ? 'ws://localhost:5000' : `ws://${window.location.host}`);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // WhatsApp States
  const [wsStatus, setWsStatus] = useState({ status: 'Disconnected', qr: null });
  const [isRestarting, setIsRestarting] = useState(false);
  
  // Data States
  const [analytics, setAnalytics] = useState({
    totalConversations: 0,
    totalAdmissions: 0,
    pendingAdmissions: 0,
    activeUsers: 0,
    dailyLeads: 0,
    monthlyLeads: 0,
    mostAskedQuestions: []
  });
  const [leads, setLeads] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState({
    botActive: true,
    greetingText: '',
    escalationContact: ''
  });

  // Selected details states
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeChatPhone, setActiveChatPhone] = useState(null);
  const [chatSearch, setChatSearch] = useState('');
  const [regSearch, setRegSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [editCourse, setEditCourse] = useState(null);
  const [isNewCourse, setIsNewCourse] = useState(false);

  // Chat scroll ref
  const chatEndRef = useRef(null);

  // Load Initial Data
  useEffect(() => {
    fetchData();
    
    // Connect WebSocket
    const ws = new WebSocket(WS_BASE);
    
    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'status') {
        setWsStatus(data);
      } else if (type === 'message') {
        // Update live conversation message list
        setConversations(prev => {
          const idx = prev.findIndex(c => c.phone === data.phone);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx].messages.push(data.message);
            if (updated[idx].messages.length > 50) updated[idx].messages.shift();
            updated[idx].lastMessageTime = data.message.timestamp;
            updated[idx].totalMessages = (updated[idx].totalMessages || 0) + 1;
            return updated;
          } else {
            return [...prev, {
              phone: data.phone,
              name: data.name,
              messages: [data.message],
              intent: 'General Info',
              registrationStatus: 'Idle',
              lastMessageTime: data.message.timestamp
            }];
          }
        });
        
        // Refresh analytics & leads if message triggers intent
        fetchAnalytics();
      } else if (type === 'registration') {
        setRegistrations(prev => [data, ...prev]);
        fetchAnalytics();
      }
    };

    return () => ws.close();
  }, []);

  // Scroll active chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatPhone, conversations]);

  const fetchData = async () => {
    fetchAnalytics();
    fetchLeads();
    fetchRegistrations();
    fetchConversations();
    fetchCourses();
    fetchSettings();
  };

  const fetchAnalytics = () => {
    fetch(`${API_BASE}/api/analytics`)
      .then(res => res.json())
      .then(data => setAnalytics(data))
      .catch(err => console.log(err));
  };

  const fetchLeads = () => {
    fetch(`${API_BASE}/api/leads`)
      .then(res => res.json())
      .then(data => setLeads(data.reverse()))
      .catch(err => console.log(err));
  };

  const fetchRegistrations = () => {
    fetch(`${API_BASE}/api/registrations`)
      .then(res => res.json())
      .then(data => setRegistrations(data.reverse()))
      .catch(err => console.log(err));
  };

  const fetchConversations = () => {
    fetch(`${API_BASE}/api/conversations`)
      .then(res => res.json())
      .then(data => setConversations(data.sort((a,b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime))))
      .catch(err => console.log(err));
  };

  const fetchCourses = () => {
    fetch(`${API_BASE}/api/courses`)
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(err => console.log(err));
  };

  const fetchSettings = () => {
    fetch(`${API_BASE}/api/settings`)
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.log(err));
  };

  // Actions
  const restartWhatsApp = async () => {
    setIsRestarting(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/restart`, { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (e) {
      alert("Error restarting client.");
    } finally {
      setIsRestarting(false);
    }
  };

  const updateLeadStatus = async (id, status) => {
    try {
      await fetch(`${API_BASE}/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchLeads();
      fetchAnalytics();
    } catch (e) {
      console.log(e);
    }
  };

  const sendDirectMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeChatPhone) return;
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${activeChatPhone}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText })
      });
      if (res.ok) {
        setReplyText('');
        // Refresh local chat view
        fetchConversations();
      } else {
        alert("WhatsApp client not connected or failed to send.");
      }
    } catch (e) {
      alert("Failed to send message.");
    }
  };

  const saveCourseData = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCourse)
      });
      fetchCourses();
      setEditCourse(null);
      setIsNewCourse(false);
    } catch (e) {
      alert("Error saving course.");
    }
  };

  const deleteCourseData = async (id) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      await fetch(`${API_BASE}/api/courses/${id}`, { method: 'DELETE' });
      fetchCourses();
    } catch (e) {
      alert("Error deleting course.");
    }
  };

  const deleteRegistrationData = async (studentId) => {
    if (!confirm(`Are you sure you want to delete registration ${studentId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/registrations/${studentId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRegistrations();
        fetchAnalytics();
        if (selectedStudent && selectedStudent.studentId === studentId) {
          setSelectedStudent(null);
        }
      } else {
        alert("Error deleting registration.");
      }
    } catch (e) {
      alert("Error deleting registration.");
    }
  };

  const deleteLeadData = async (id) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/leads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLeads();
        fetchAnalytics();
      } else {
        alert("Error deleting lead.");
      }
    } catch (e) {
      alert("Error deleting lead.");
    }
  };

  const saveSettingsData = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      alert("Settings saved successfully.");
    } catch (e) {
      alert("Error saving settings.");
    }
  };

  // Get active chat detail object
  const activeChat = conversations.find(c => c.phone === activeChatPhone);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#08090c' }}>
      
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: '260px', margin: '16px', display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'sticky', top: '16px', height: 'calc(100vh - 32px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px', paddingLeft: '8px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--color-primary), #0284c7)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#040814', fontSize: '1.25rem' }}>T</div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.5px' }}>TSS Panel</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI ADMISSION OFFICER</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {[
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'whatsapp', name: 'WhatsApp Connection', icon: QrCode },
            { id: 'admissions', name: 'Admissions', icon: Users },
            { id: 'chat', name: 'Live Chat', icon: MessageSquare },
            { id: 'courses', name: 'Courses', icon: BookOpen },
            { id: 'settings', name: 'Settings', icon: SettingsIcon }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '10px',
                  color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                  background: active ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 500,
                  transition: 'var(--transition-smooth)'
                }}
              >
                <Icon size={18} />
                <span style={{ fontSize: '0.95rem' }}>{tab.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Status Footer */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-muted)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: wsStatus.status === 'Connected' ? 'var(--color-success)' : wsStatus.status === 'QR_Ready' ? 'var(--color-accent)' : 'var(--color-error)' }} className={wsStatus.status === 'Connected' ? 'pulse-glow' : ''}></span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bot: {wsStatus.status}</span>
          </div>
          <button onClick={restartWhatsApp} disabled={isRestarting} style={{ padding: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} className="btn-secondary">
            <RefreshCw size={12} className={isRestarting ? 'spin-anim' : ''} /> {isRestarting ? "Restarting..." : "Restart Session"}
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main style={{ flex: 1, padding: '24px 32px 32px 16px', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        
        {/* Header bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{activeTab === 'chat' ? 'Live Chat Support' : activeTab}</h1>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {activeTab === 'dashboard' && 'Real-time overview of registrations, leads, and bot metrics.'}
              {activeTab === 'whatsapp' && 'Link the assistant to your official WhatsApp number.'}
              {activeTab === 'admissions' && 'View completed registrations, verify data, and download forms.'}
              {activeTab === 'chat' && 'Jump in to reply to messages manually when needed.'}
              {activeTab === 'courses' && 'Manage courses, pricing tiers, schedules, and duration.'}
              {activeTab === 'settings' && 'Configure bot automatic responses and emergency contacts.'}
            </span>
          </div>
          <button onClick={fetchData} className="btn-secondary" style={{ padding: '8px 12px' }}><RefreshCw size={14} /> Refresh</button>
        </header>

        {/* Tab Switcher Body */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* 1. Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stat Cards */}
              <div className="dashboard-grid">
                {[
                  { title: 'Total Conversations', value: analytics.totalConversations, icon: MessageSquare, color: 'var(--color-primary)' },
                  { title: 'Total Admissions', value: analytics.totalAdmissions, icon: Users, color: 'var(--color-success)' },
                  { title: 'Pending Admissions', value: analytics.pendingAdmissions, icon: Clock, color: 'var(--color-accent)' },
                  { title: 'Active Users (7 Days)', value: analytics.activeUsers, icon: Users, color: '#a855f7' }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ backgroundColor: `rgba(255,255,255,0.03)`, border: `1px solid var(--border-muted)`, color: stat.color, padding: '16px', borderRadius: '12px' }}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.title}</span>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>{stat.value}</h3>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Charts & Lead stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', flex: 1, minHeight: '350px' }}>
                
                {/* SVG Analytical Chart */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Daily Lead Registrations</h3>
                  <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                    {/* SVG Line chart representing mock lead growth */}
                    <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {/* Grid lines */}
                      <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                      <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                      <line x1="0" y1="140" x2="500" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                      
                      {/* Chart Path */}
                      <path
                        d="M 10 170 Q 90 140 170 120 T 330 90 T 490 30"
                        fill="none"
                        stroke="url(#chartGradient)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      {/* Area Fill */}
                      <path
                        d="M 10 170 Q 90 140 170 120 T 330 90 T 490 30 L 490 190 L 10 190 Z"
                        fill="url(#areaGradient)"
                        opacity="0.2"
                      />
                      
                      {/* Definitions */}
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--color-primary)" />
                          <stop offset="100%" stopColor="var(--color-accent)" />
                        </linearGradient>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" />
                          <stop offset="100%" stopColor="transparent" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '12px', borderTop: '1px solid var(--border-muted)', paddingTop: '12px' }}>
                    <span>Total Leads: {analytics.dailyLeads} (Today)</span>
                    <span>Monthly Growth: {analytics.monthlyLeads} (Leads)</span>
                  </div>
                </div>

                {/* Most Asked Queries & Recent leads */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Most asked intents */}
                  <div className="glass-panel" style={{ padding: '20px', flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Top Inquired Intents</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {analytics.mostAskedQuestions.length > 0 ? (
                        analytics.mostAskedQuestions.map((intent, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{intent}</span>
                            <span className="badge badge-connected" style={{ fontSize: '0.7rem' }}>Rank #{idx + 1}</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No data collected yet.</span>
                      )}
                    </div>
                  </div>

                  {/* Leads Summary */}
                  <div className="glass-panel" style={{ padding: '20px', flex: 1, maxHeight: '200px', overflowY: 'auto' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Recent Leads</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {leads.slice(0, 5).map((lead, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{lead.name}</span>
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>({lead.course})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: lead.status === 'Converted' ? 'var(--color-success)' : 'var(--color-accent)', fontWeight: 500 }}>{lead.status}</span>
                            <button onClick={() => deleteLeadData(lead.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }} title="Delete Lead">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                </div>
              </div>
            </>
          )}

          {/* 2. WhatsApp Connection Tab */}
          {activeTab === 'whatsapp' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
              {/* QR Panel */}
              <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Scan QR Code</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>Scan this QR code with WhatsApp Linked Devices to link the AI bot.</p>
                
                {wsStatus.status === 'QR_Ready' && wsStatus.qr ? (
                  <div className="pulse-glow" style={{ padding: '16px', background: 'white', borderRadius: '16px', display: 'inline-block', marginBottom: '24px' }}>
                    <img src={wsStatus.qr} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                  </div>
                ) : wsStatus.status === 'Connected' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: '40px 0' }}>
                    <CheckCircle size={80} color="var(--color-success)" />
                    <span style={{ fontSize: '1.2rem', color: 'var(--color-success)', fontWeight: 600 }}>Successfully Connected!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: '40px 0' }}>
                    <Clock size={80} color="var(--text-muted)" />
                    <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Waiting for QR code generation...</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                  <button onClick={restartWhatsApp} disabled={isRestarting} style={{ flex: 1 }} className="btn-primary">
                    <RefreshCw size={14} /> Restart Client
                  </button>
                </div>
              </div>

              {/* Instructions & Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Instructions</h3>
                  <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    <li>Open WhatsApp on your mobile device.</li>
                    <li>Tap **Menu** (three dots on Android) or **Settings** (iOS) and select **Linked Devices**.</li>
                    <li>Tap **Link a Device**.</li>
                    <li>Point your phone camera to this dashboard screen to scan the QR code.</li>
                    <li>Once scanned, the bot connection status will change to **Connected** and start answering student inquiries automatically.</li>
                  </ol>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Bot Behavior Settings</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Auto-Responder Status</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toggle the bot reply module on WhatsApp chat events.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.botActive}
                        onChange={(e) => {
                          const updated = { ...settings, botActive: e.target.checked };
                          setSettings(updated);
                          fetch(`${API_BASE}/api/settings`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updated)
                          });
                        }}
                        style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Admissions Tab */}
          {activeTab === 'admissions' && (
            <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
              
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search by student name, ID, or course..."
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    className="glass-input"
                    style={{ width: '100%', paddingLeft: '38px' }}
                  />
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Full Name</th>
                      <th>Course Name</th>
                      <th>Phone</th>
                      <th>WhatsApp</th>
                      <th>City</th>
                      <th>Registration Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations
                      .filter(r => 
                        r.fullName.toLowerCase().includes(regSearch.toLowerCase()) ||
                        r.studentId.toLowerCase().includes(regSearch.toLowerCase()) ||
                        r.course.toLowerCase().includes(regSearch.toLowerCase())
                      )
                      .map((reg) => (
                        <tr key={reg.studentId} onClick={() => setSelectedStudent(reg)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{reg.studentId}</td>
                          <td>{reg.fullName}</td>
                          <td>{reg.course}</td>
                          <td>{reg.phone}</td>
                          <td>{reg.whatsapp}</td>
                          <td>{reg.city}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {reg.generatedPdf && (
                                <a href={`${API_BASE}${reg.generatedPdf}`} download className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                  <Download size={12} /> PDF
                                </a>
                              )}
                              {reg.generatedImage && (
                                <a href={`${API_BASE}${reg.generatedImage}`} download className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
                                  <Download size={12} /> PNG
                                </a>
                              )}
                              <button onClick={() => deleteRegistrationData(reg.studentId)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }} title="Delete Registration">
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Student Details Modal Side Drawer */}
              {selectedStudent && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-muted)', padding: '32px', zIndex: 100, overflowY: 'auto', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>
                  <div className="flex-between" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Registration Details</h3>
                    <button onClick={() => setSelectedStudent(null)} className="btn-secondary" style={{ padding: '4px 8px' }}>Close</button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>STUDENT ID</span>
                      <h4 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontWeight: 700 }}>{selectedStudent.studentId}</h4>
                    </div>

                    {[
                      { section: 'Personal Information', fields: [
                        { label: 'Full Name', value: selectedStudent.fullName },
                        { label: "Father's Name", value: selectedStudent.fatherName },
                        { label: 'CNIC / B-Form', value: selectedStudent.cnic },
                        { label: 'Date of Birth', value: selectedStudent.dob },
                        { label: 'Gender', value: selectedStudent.gender },
                        { label: 'Nationality', value: selectedStudent.nationality },
                        { label: 'Religion', value: selectedStudent.religion },
                        { label: 'Phone', value: selectedStudent.phone },
                        { label: 'WhatsApp', value: selectedStudent.whatsapp },
                        { label: 'Email', value: selectedStudent.email },
                        { label: 'Address', value: selectedStudent.address },
                        { label: 'City', value: selectedStudent.city },
                        { label: 'Postal Code', value: selectedStudent.postalCode }
                      ]},
                      { section: 'Academic Profile', fields: [
                        { label: 'Qualification', value: selectedStudent.qualification },
                        { label: 'School / College', value: selectedStudent.school },
                        { label: 'Passing Year', value: selectedStudent.passingYear },
                        { label: 'Marks / CGPA', value: selectedStudent.marks }
                      ]},
                      { section: 'Course Details', fields: [
                        { label: 'Course Name', value: selectedStudent.course },
                        { label: 'Batch Timing', value: selectedStudent.batch },
                        { label: 'Preferred Days', value: selectedStudent.preferredDays },
                        { label: 'Reference / Source', value: selectedStudent.reference }
                      ]},
                      { section: 'Emergency Contact Info', fields: [
                        { label: 'Emergency Contact Person', value: selectedStudent.emergencyName },
                        { label: 'Relationship', value: selectedStudent.relationship },
                        { label: 'Phone Number', value: selectedStudent.emergencyPhone },
                        { label: 'Alternate Phone', value: selectedStudent.alternatePhone },
                        { label: 'Emergency Address', value: selectedStudent.emergencyAddress }
                      ]}
                    ].map((sec, i) => (
                      <div key={i}>
                        <h5 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px', marginBottom: '10px' }}>{sec.section}</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sec.fields.map((f, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{f.label}:</span>
                              <span style={{ fontWeight: 500, textAlign: 'right' }}>{f.value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 4. Live Chat Tab */}
          {activeTab === 'chat' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', flex: 1, height: 'calc(100vh - 200px)' }}>
              
              {/* Chat List Column */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-muted)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search chats..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      className="glass-input"
                      style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {conversations
                    .filter(c => c.name.toLowerCase().includes(chatSearch.toLowerCase()) || c.phone.includes(chatSearch))
                    .map((conv) => {
                      const lastMsg = conv.messages[conv.messages.length - 1];
                      const active = activeChatPhone === conv.phone;
                      return (
                        <div
                          key={conv.phone}
                          onClick={() => {
                            setActiveChatPhone(conv.phone);
                            // Clear state
                            setReplyText('');
                          }}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid var(--border-muted)',
                            cursor: 'pointer',
                            backgroundColor: active ? 'rgba(255,255,255,0.03)' : 'transparent',
                            borderLeft: active ? '3px solid var(--color-primary)' : 'none',
                            transition: 'var(--transition-smooth)'
                          }}
                        >
                          <div className="flex-between" style={{ marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{conv.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="flex-between">
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                              {lastMsg ? lastMsg.text : 'No messages'}
                            </span>
                            <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>{conv.intent}</span>
                          </div>
                          {conv.registrationStatus === 'Active' && (
                            <span style={{ display: 'inline-block', fontSize: '0.7rem', color: 'var(--color-accent)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px', marginTop: '6px', fontWeight: 600 }}>
                              📝 Step {conv.activeStep + 1}/26
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Chat Detail Message Pane */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeChatPhone ? (
                  <>
                    {/* Chat Header */}
                    <div className="flex-between" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <div>
                        <h4 style={{ fontWeight: 600 }}>{activeChat ? activeChat.name : activeChatPhone}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeChatPhone}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="badge badge-connected">{activeChat ? activeChat.registrationStatus : 'Idle'}</span>
                      </div>
                    </div>

                    {/* Messages Body */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {activeChat && activeChat.messages.map((msg, i) => {
                        const isStudent = msg.sender === 'student';
                        return (
                          <div
                            key={i}
                            style={{
                              alignSelf: isStudent ? 'flex-start' : 'flex-end',
                              maxWidth: '70%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isStudent ? 'flex-start' : 'flex-end'
                            }}
                          >
                            <div
                              style={{
                                backgroundColor: isStudent ? 'rgba(255, 255, 255, 0.04)' : 'rgba(56, 189, 248, 0.08)',
                                border: isStudent ? '1px solid var(--border-muted)' : '1px solid rgba(56, 189, 248, 0.15)',
                                padding: '12px 16px',
                                borderRadius: isStudent ? '12px 12px 12px 0' : '12px 12px 0 12px',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                lineHeight: '1.4',
                                whiteSpace: 'pre-line'
                              }}
                            >
                              {msg.text}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Send reply footer */}
                    <form onSubmit={sendDirectMessage} style={{ padding: '16px', borderTop: '1px solid var(--border-muted)', display: 'flex', gap: '12px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <input
                        type="text"
                        placeholder="Type a message to reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="glass-input"
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="btn-primary" style={{ padding: '10px 14px' }}><Send size={16} /></button>
                    </form>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <MessageSquare size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <span>Select a conversation from the sidebar to view history and chat live.</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 5. Courses Tab */}
          {activeTab === 'courses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setEditCourse({ name: '', duration: '', fee: '', installment: '', schedule: '', description: '', careerOpportunities: '' });
                    setIsNewCourse(true);
                  }}
                  className="btn-primary"
                >
                  <Plus size={16} /> Add Program
                </button>
              </div>

              {/* Courses Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {courses.map((course) => (
                  <div key={course.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <div className="flex-between" style={{ marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{course.name}</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              setEditCourse(course);
                              setIsNewCourse(false);
                            }}
                            className="btn-secondary"
                            style={{ padding: '6px 8px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCourseData(course.id)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px', color: 'var(--color-error)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '16px' }}>{course.description}</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-muted)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <Calendar size={14} color="var(--text-secondary)" />
                          <span>Duration: <b>{course.duration}</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <DollarSign size={14} color="var(--text-secondary)" />
                          <span>Fee: <b>{course.fee}</b> ({course.installment})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                          <Clock size={14} color="var(--text-secondary)" />
                          <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Schedule: {course.schedule}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid var(--border-muted)' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Career Paths:</span>
                      <span>{course.careerOpportunities}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add/Edit Course Modal Box */}
              {editCourse && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
                  <form onSubmit={saveCourseData} className="glass-panel" style={{ width: '500px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{isNewCourse ? 'Add New Coaching Program' : 'Edit Coaching Program'}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Program Name</label>
                      <input type="text" required value={editCourse.name} onChange={(e) => setEditCourse({ ...editCourse, name: e.target.value })} className="glass-input" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duration</label>
                        <input type="text" required placeholder="e.g. 4 Months" value={editCourse.duration} onChange={(e) => setEditCourse({ ...editCourse, duration: e.target.value })} className="glass-input" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Course Fee</label>
                        <input type="text" required placeholder="e.g. 24,000 PKR" value={editCourse.fee} onChange={(e) => setEditCourse({ ...editCourse, fee: e.target.value })} className="glass-input" />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Installment Tier</label>
                        <input type="text" required placeholder="e.g. 6,000 PKR/Month" value={editCourse.installment} onChange={(e) => setEditCourse({ ...editCourse, installment: e.target.value })} className="glass-input" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Weekly Schedule</label>
                        <input type="text" required placeholder="e.g. Sat & Sun (10-12)" value={editCourse.schedule} onChange={(e) => setEditCourse({ ...editCourse, schedule: e.target.value })} className="glass-input" />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description</label>
                      <textarea required rows={3} value={editCourse.description} onChange={(e) => setEditCourse({ ...editCourse, description: e.target.value })} className="glass-input" style={{ resize: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Career Opportunities</label>
                      <input type="text" required placeholder="e.g. Graphic Designer, UI/UX Architect" value={editCourse.careerOpportunities} onChange={(e) => setEditCourse({ ...editCourse, careerOpportunities: e.target.value })} className="glass-input" />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                      <button type="button" onClick={() => setEditCourse(null)} className="btn-secondary">Cancel</button>
                      <button type="submit" className="btn-primary">Save Changes</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 6. Settings Tab */}
          {activeTab === 'settings' && (
            <div className="glass-panel" style={{ padding: '32px', maxWidth: '600px' }}>
              <form onSubmit={saveSettingsData} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, borderBottom: '1px solid var(--border-muted)', paddingBottom: '12px' }}>Bot Configurations</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Active Auto-Reply Bot</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Control whether the bot should auto-answer customer queries.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.botActive}
                    onChange={(e) => setSettings({ ...settings, botActive: e.target.checked })}
                    style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.95rem', fontWeight: 600 }}>Escalation Phone Contact</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>The number provided when a student requests human support.</p>
                  <input
                    type="text"
                    required
                    value={settings.escalationContact}
                    onChange={(e) => setSettings({ ...settings, escalationContact: e.target.value })}
                    className="glass-input"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.95rem', fontWeight: 600 }}>Default Greeting Message</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Introduces the institute when a conversation session resets.</p>
                  <textarea
                    required
                    rows={4}
                    value={settings.greetingText}
                    onChange={(e) => setSettings({ ...settings, greetingText: e.target.value })}
                    className="glass-input"
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="submit" className="btn-primary">Save Configurations</button>
                </div>
              </form>
            </div>
          )}

        </section>
      </main>

      {/* Global CSS spinner animations */}
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
