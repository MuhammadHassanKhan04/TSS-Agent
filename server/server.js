require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const whatsapp = require('./whatsapp');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(express.json());

// Serve static assets from generated registrations
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// API Routes
// 1. WhatsApp status & management
app.get('/api/whatsapp/status', (req, res) => {
    res.json(whatsapp.getStatus());
});

app.post('/api/whatsapp/restart', (req, res) => {
    try {
        const client = whatsapp.getClient();
        if (client) {
            client.destroy().catch(err => console.log("Error destroying client:", err));
        }
        whatsapp.init();
        res.json({ success: true, message: "Re-initializing WhatsApp Web client..." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Student Registrations
app.get('/api/registrations', (req, res) => {
    res.json(db.getRegistrations());
});

app.get('/api/registrations/:studentId', (req, res) => {
    const regs = db.getRegistrations();
    const reg = regs.find(r => r.studentId === req.params.studentId);
    if (reg) {
        res.json(reg);
    } else {
        res.status(404).json({ error: "Registration not found" });
    }
});

app.delete('/api/registrations/:studentId', (req, res) => {
    const success = db.deleteRegistration(req.params.studentId);
    res.json({ success });
});

// 3. Leads
app.get('/api/leads', (req, res) => {
    res.json(db.getLeads());
});

app.post('/api/leads', (req, res) => {
    const lead = db.addLead(req.body);
    res.json(lead);
});

app.put('/api/leads/:id', (req, res) => {
    const lead = db.updateLead(req.params.id, req.body);
    if (lead) {
        res.json(lead);
    } else {
        res.status(404).json({ error: "Lead not found" });
    }
});

app.delete('/api/leads/:id', (req, res) => {
    const success = db.deleteLead(req.params.id);
    res.json({ success });
});

// 4. Conversations
app.get('/api/conversations', (req, res) => {
    res.json(db.getConversations());
});

app.get('/api/conversations/:phone', (req, res) => {
    const conv = db.getConversation(req.params.phone);
    if (conv) {
        res.json(conv);
    } else {
        res.status(404).json({ error: "Conversation not found" });
    }
});

app.post('/api/conversations/:phone/message', async (req, res) => {
    const { text } = req.body;
    const phone = req.params.phone;
    
    try {
        const client = whatsapp.getClient();
        if (!client || whatsapp.getStatus().status !== 'Connected') {
            return res.status(400).json({ error: "WhatsApp is not connected." });
        }

        // Save assistant message in DB
        db.saveMessage(phone, null, { sender: 'assistant', text });
        
        // Send via WhatsApp
        await client.sendMessage(phone, text);
        
        // Broadcast
        const conv = db.getConversation(phone);
        const name = conv ? conv.name : phone;
        
        if (wsServerInstance) {
            const payload = JSON.stringify({
                type: 'message',
                data: { phone, name, message: { sender: 'assistant', text, timestamp: new Date().toISOString() } }
            });
            wsServerInstance.clients.forEach(c => {
                if (c.readyState === 1) c.send(payload);
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Courses
app.get('/api/courses', (req, res) => {
    res.json(db.getCourses());
});

app.post('/api/courses', (req, res) => {
    const course = db.saveCourse(req.body);
    res.json(course);
});

app.delete('/api/courses/:id', (req, res) => {
    const success = db.deleteCourse(req.params.id);
    res.json({ success });
});

// 6. Settings
app.get('/api/settings', (req, res) => {
    res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
    const settings = db.saveSettings(req.body);
    res.json(settings);
});

// 7. Analytics
app.get('/api/analytics', (req, res) => {
    res.json(db.getAnalytics());
});

// Serve frontend client in production
const CLIENT_BUILD_DIR = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_BUILD_DIR));

app.get(/.*/, (req, res, next) => {
    // If API, let Express handle it or 404
    if (req.path.startsWith('/api')) {
        return next();
    }
    // Serve React index.html
    res.sendFile(path.join(CLIENT_BUILD_DIR, 'index.html'));
});

// Setup WebSockets
let wsServerInstance = null;

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    console.log("WebSocket client connected to server.");
    // Immediately send current status
    ws.send(JSON.stringify({ type: 'status', data: whatsapp.getStatus() }));
});

// Link WebSocket server to WhatsApp module
whatsapp.setWsServer(wss);
wsServerInstance = wss;

// Initialize WhatsApp Client on server bootup
whatsapp.init();

// Boot Express Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Express Backend Server running on port ${PORT}`);
});
