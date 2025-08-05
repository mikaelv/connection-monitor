class ConnectionMonitorClient {
    constructor(options = {}) {
        this.ws = null;
        this.pingInterval = null;
        this.studentId = options.studentId || 'anonymous';
        this.studentName = options.studentName || this.studentId;
        this.sessionId = options.sessionId || null;
        this.onMessage = options.onMessage || (() => {});
        this.onStatusChange = options.onStatusChange || (() => {});
        this.pingIntervalMs = options.pingInterval || 1000;
    }

    addMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.onMessage(`[${timestamp}] ${message}`);
    }

    updateStatus(connected) {
        this.onStatusChange(connected);
    }

    connect() {
        let wsUrl = `ws://${window.location.host}?student=${encodeURIComponent(this.studentId)}`;
        
        if (this.studentName && this.studentName !== this.studentId) {
            wsUrl += `&name=${encodeURIComponent(this.studentName)}`;
        }
        
        if (this.sessionId) {
            wsUrl += `&session=${this.sessionId}`;
        }

        this.addMessage(`Connecting to ${wsUrl}...`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.addMessage('Connected to monitor successfully!');
            this.updateStatus(true);
            
            this.pingInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    const pingData = { type: 'ping' };
                    if (this.sessionId) {
                        pingData.session = this.sessionId;
                    }
                    this.ws.send(JSON.stringify(pingData));
                }
            }, this.pingIntervalMs);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'welcome') {
                    this.addMessage('Welcome! You are now being monitored.');
                } else if (data.type === 'pong') {
                    // Uncomment for debugging: this.addMessage('Monitor confirmed - still connected');
                } else {
                    this.addMessage(`Server: ${event.data}`);
                }
            } catch (error) {
                this.addMessage(`Server: ${event.data}`);
            }
        };
        
        this.ws.onclose = (event) => {
            this.addMessage(`Disconnected from monitor. Code: ${event.code}, Reason: ${event.reason || 'Unknown'}`);
            this.updateStatus(false);
            this.cleanup();
        };
        
        this.ws.onerror = (error) => {
            this.addMessage('Connection error occurred');
            this.updateStatus(false);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.cleanup();
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
            return true;
        }
        return false;
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}