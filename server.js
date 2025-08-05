const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const connectedStudents = new Map();
const connectionLogs = [];

function logConnection(studentId, event, reason = '') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        studentId,
        event,
        reason,
        totalConnected: connectedStudents.size
    };
    
    connectionLogs.push(logEntry);
    console.log(`[${timestamp}] ${event.toUpperCase()}: Student ${studentId} ${reason ? `(${reason})` : ''} - Total connected: ${connectedStudents.size}`);
    
    if (connectionLogs.length > 1000) {
        connectionLogs.shift();
    }
}

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    const studentId = req.url.split('?student=')[1] || `anonymous-${Date.now()}`;
    
    const studentInfo = {
        id: studentId,
        ip: clientIP,
        connectedAt: new Date(),
        ws: ws,
        lastPing: new Date()
    };
    
    connectedStudents.set(studentId, studentInfo);
    logConnection(studentId, 'connected', `from ${clientIP}`);
    
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
        logConnection(studentId, 'disconnected', `code: ${code}, reason: ${reason || 'unknown'}`);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for student ${studentId}:`, error);
        connectedStudents.delete(studentId);
        logConnection(studentId, 'error', error.message);
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
        if (timeSinceLastPing > 30000) {
            student.ws.terminate();
            connectedStudents.delete(studentId);
            logConnection(studentId, 'timeout', 'no ping for 30 seconds');
        }
    });
}, 15000);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
    const students = Array.from(connectedStudents.values()).map(student => ({
        id: student.id,
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