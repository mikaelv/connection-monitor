# Student Connection Monitor

WebSocket server to monitor and trace student connections to ensure they stay connected to your network.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Access the dashboard:**
   - Local: http://localhost:3000
   - Test client: http://localhost:3000/client-example.html

## Network Access from Other Computers

### If running in WSL (Windows Subsystem for Linux):

1. **Find your WSL IP:**
   ```bash
   hostname -I
   ```

2. **Set up port forwarding (Windows Command Prompt as Administrator):**
   ```cmd
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=WSL_IP_HERE
   ```
   Replace `WSL_IP_HERE` with the IP from step 1.

3. **Verify port forwarding:**
   ```cmd
   netsh interface portproxy show all
   ```

4. **Find your Windows ethernet IP:**
   ```cmd
   ipconfig
   ```
   Look for "Ethernet adapter" IPv4 address.

5. **Students connect using your Windows ethernet IP:**
   ```
   ws://YOUR_ETHERNET_IP:3000?student=STUDENT_ID
   ```

### To remove port forwarding later:
```cmd
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0
```

## Student Connection

Students connect via WebSocket using:
```
ws://YOUR_IP:3000?student=THEIR_STUDENT_ID
```

Example JavaScript:
```javascript
const ws = new WebSocket('ws://192.168.1.100:3000?student=john_doe');

ws.onopen = () => console.log('Connected!');
ws.onclose = (e) => console.log('Disconnected:', e.code);

// Send ping every 30 seconds to maintain connection
setInterval(() => {
    ws.send(JSON.stringify({type: 'ping'}));
}, 30000);
```

## Features

- **Real-time monitoring** - Live dashboard showing connected students
- **Connection logging** - All connections/disconnections logged with timestamps
- **Automatic timeout detection** - Students disconnected after 60 seconds without ping
- **Disconnect tracing** - Detailed logging of disconnect reasons and codes
- **REST API** - `/api/status` endpoint for programmatic access

## Access Points

- **Dashboard:** http://YOUR_IP:3000
- **WebSocket:** ws://YOUR_IP:3000?student=STUDENT_ID
- **API:** http://YOUR_IP:3000/api/status
- **Test Client:** http://YOUR_IP:3000/client-example.html

## Connection States Tracked

- **Connected** - Student successfully connected
- **Disconnected** - Normal disconnection with reason code
- **Timeout** - No ping received for 60+ seconds
- **Error** - WebSocket error occurred