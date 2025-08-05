const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const connectedStudents = new Map();
const connectionLogs = [];
const ltiSessions = new Map();

function logConnection(studentId, event, reason = '', studentName = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        studentId,
        studentName: studentName || studentId,
        event,
        reason,
        totalConnected: connectedStudents.size
    };
    
    connectionLogs.push(logEntry);
    const displayName = studentName ? `${studentName} (${studentId})` : studentId;
    console.log(`[${timestamp}] ${event.toUpperCase()}: Student ${displayName} ${reason ? `(${reason})` : ''} - Total connected: ${connectedStudents.size}`);
    
    if (connectionLogs.length > 1000) {
        connectionLogs.shift();
    }
}

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const studentId = urlParams.get('student') || `anonymous-${Date.now()}`;
    const studentName = urlParams.get('name') || studentId;
    
    const studentInfo = {
        id: studentId,
        name: studentName,
        ip: clientIP,
        connectedAt: new Date(),
        ws: ws,
        lastPing: new Date()
    };
    
    connectedStudents.set(studentId, studentInfo);
    logConnection(studentId, 'connected', `from ${clientIP}`, studentName);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                connectedStudents.get(studentId).lastPing = new Date();
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
        } catch (error) {
            console.log(`Received message from ${studentId}: ${message}`);
        }
    });
    
    ws.on('close', (code, reason) => {
        connectedStudents.delete(studentId);
        logConnection(studentId, 'disconnected', `code: ${code}, reason: ${reason || 'unknown'}`, studentName);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for student ${studentId}:`, error);
        connectedStudents.delete(studentId);
        logConnection(studentId, 'error', error.message, studentName);
    });
    
    ws.send(JSON.stringify({ 
        type: 'welcome', 
        studentId: studentId,
        serverTime: new Date().toISOString() 
    }));
});

setInterval(() => {
    const now = new Date();
    connectedStudents.forEach((student, studentId) => {
        const timeSinceLastPing = now - student.lastPing;
        if (timeSinceLastPing > 3000) {
            student.ws.terminate();
            connectedStudents.delete(studentId);
            logConnection(studentId, 'timeout', 'no ping for 3 seconds', student.name);
        }
    });
}, 1500);

// LTI 1.0/1.1 Launch endpoint
app.post('/lti/launch', async (req, res) => {
    try {
        console.log('LTI Launch data:', req.body);
        
        // Extract student information from LTI 1.0 parameters
        const studentInfo = {
            id: req.body.user_id || req.body.lis_person_sourcedid,
            name: req.body.lis_person_name_full || `${req.body.lis_person_name_given || ''} ${req.body.lis_person_name_family || ''}`.trim(),
            email: req.body.lis_person_contact_email_primary,
            courseName: req.body.context_title || req.body.context_label || 'Unknown Course',
            courseId: req.body.context_id,
            roles: req.body.roles,
            username: req.body.ext_user_username,
            sessionId: Math.random().toString(36).substring(7)
        };

        if (!studentInfo.id) {
            return res.status(400).json({ error: 'Missing user_id in LTI launch' });
        }

        // Store LTI session
        ltiSessions.set(studentInfo.sessionId, {
            ...studentInfo,
            launchTime: new Date(),
            ltiData: req.body
        });

        console.log(`LTI Launch: ${studentInfo.name} (${studentInfo.id}) - ${studentInfo.roles} from ${studentInfo.courseName}`);

        // Redirect to LTI launch page with session ID
        res.redirect(`/lti-launch.html?session=${studentInfo.sessionId}`);

    } catch (error) {
        console.error('LTI Launch error:', error);
        res.status(500).json({ error: 'Failed to process LTI launch' });
    }
});

// API endpoint to get LTI session data
app.get('/api/lti-session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = ltiSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    // Return session data without the JWT token
    const { token, ...sessionData } = session;
    res.json(sessionData);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
    const students = Array.from(connectedStudents.values()).map(student => ({
        id: student.id,
        name: student.name,
        ip: student.ip,
        connectedAt: student.connectedAt,
        lastPing: student.lastPing
    }));
    
    res.json({
        totalConnected: connectedStudents.size,
        students: students,
        recentLogs: connectionLogs.slice(-50)
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Connection monitor server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://YOUR_PC_IP:${PORT}?student=STUDENT_ID`);
    console.log(`Dashboard: http://YOUR_PC_IP:${PORT}`);
    console.log(`API endpoint: http://YOUR_PC_IP:${PORT}/api/status`);
});