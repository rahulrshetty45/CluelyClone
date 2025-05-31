const { app, BrowserWindow, systemPreferences, shell, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');

class CluelyAudioCompanion {
    constructor() {
        this.window = null;
        this.wsServer = null;
        this.audioStream = null;
        this.isCapturing = false;
        this.swiftAppConnected = false;
        this.connectedClients = [];
    }

    async initialize() {
        console.log('🎤 Initializing Cluely Audio Companion...');
        
        // Create hidden window for audio capture
        this.createWindow();
        
        // Setup WebSocket server for Swift communication
        this.setupWebSocketServer();
        
        // Setup IPC handlers
        this.setupIPC();
        
        console.log('✅ Audio companion ready');
    }

    createWindow() {
        this.window = new BrowserWindow({
            width: 300,
            height: 200,
            show: false, // Hidden by default - background service
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            },
            skipTaskbar: true, // Don't show in dock/taskbar
            resizable: false,
            frame: false
        });

        this.window.loadFile('index.html');
        
        // Forward renderer console output to main process
        this.window.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[RENDERER] ${message}`);
        });
        
        // Show DevTools for debugging if needed
        // this.window.webContents.openDevTools();
        
        // Keep app running in background
        this.window.on('close', (event) => {
            if (!app.isQuiting) {
                event.preventDefault();
                this.window.hide();
            }
        });

        console.log('🪟 Background audio capture window created');
    }

    setupWebSocketServer() {
        // Create WebSocket server on port 8765 for Swift communication
        this.wsServer = new WebSocket.Server({ port: 8765 });
        
        this.wsServer.on('connection', (ws) => {
            console.log('🔗 Swift app connected via WebSocket');
            this.swiftAppConnected = true;
            this.connectedClients.push(ws);
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleSwiftMessage(data, ws);
                } catch (error) {
                    console.error('❌ Error processing message:', error);
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: error.message 
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log('🔌 Swift app disconnected');
                this.swiftAppConnected = false;
                this.connectedClients = this.connectedClients.filter(client => client !== ws);
            });
            
            // Send initial status
            ws.send(JSON.stringify({ 
                type: 'status', 
                ready: true,
                permissions: {
                    microphone: systemPreferences.getMediaAccessStatus('microphone'),
                    camera: systemPreferences.getMediaAccessStatus('camera')
                }
            }));
        });

        console.log('🌐 WebSocket server listening on port 8765');
    }

    async handleSwiftMessage(data, ws) {
        console.log('📨 Received from Swift:', data.type);
        
        switch (data.type) {
            case 'requestPermissions':
                await this.requestPermissions(ws);
                break;
                
            case 'startAudioCapture':
                await this.startAudioCapture(ws);
                break;
                
            case 'stopAudioCapture':
                await this.stopAudioCapture(ws);
                break;
                
            case 'getPermissionStatus':
                this.sendPermissionStatus(ws);
                break;
                
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
                
            default:
                console.log('❓ Unknown message type:', data.type);
        }
    }

    async requestPermissions(ws) {
        console.log('🔑 Requesting permissions...');
        
        try {
            // Request microphone permission
            const micGranted = await systemPreferences.askForMediaAccess('microphone');
            console.log('🎤 Microphone permission:', micGranted ? 'granted' : 'denied');
            
            // Request camera permission (for screen recording on some macOS versions)
            const cameraGranted = await systemPreferences.askForMediaAccess('camera');
            console.log('📷 Camera permission:', cameraGranted ? 'granted' : 'denied');
            
            // Send results back to Swift
            ws.send(JSON.stringify({
                type: 'permissionsResult',
                microphone: micGranted,
                camera: cameraGranted,
                success: micGranted
            }));
            
            // If permissions denied, guide user to settings
            if (!micGranted) {
                this.openPermissionSettings(ws);
            }
            
        } catch (error) {
            console.error('❌ Permission request error:', error);
            ws.send(JSON.stringify({
                type: 'permissionsResult',
                error: error.message,
                success: false
            }));
        }
    }

    sendPermissionStatus(ws) {
        const status = {
            type: 'permissionStatus',
            microphone: systemPreferences.getMediaAccessStatus('microphone'),
            camera: systemPreferences.getMediaAccessStatus('camera')
        };
        
        ws.send(JSON.stringify(status));
        console.log('📊 Sent permission status:', status);
    }

    async openPermissionSettings(ws) {
        console.log('⚙️ Opening permission settings...');
        
        try {
            if (process.platform === 'darwin') {
                // Open macOS privacy settings
                await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
                
                ws.send(JSON.stringify({
                    type: 'settingsOpened',
                    message: 'Please enable microphone access and restart the app'
                }));
            }
        } catch (error) {
            console.error('❌ Error opening settings:', error);
        }
    }

    async startAudioCapture(ws) {
        if (this.isCapturing) {
            console.log('🎤 Already capturing audio');
            return;
        }

        console.log('🎤 Starting audio capture...');
        
        try {
            // Send message to renderer to start audio capture
            this.window.webContents.send('startAudioCapture');
            this.isCapturing = true;
            
            ws.send(JSON.stringify({
                type: 'audioCaptureStarted',
                success: true
            }));
            
            console.log('✅ Audio capture started');
            
        } catch (error) {
            console.error('❌ Audio capture error:', error);
            this.isCapturing = false;
            
            ws.send(JSON.stringify({
                type: 'audioCaptureError',
                error: error.message
            }));
        }
    }

    async stopAudioCapture(ws) {
        if (!this.isCapturing) {
            console.log('🛑 Not currently capturing');
            return;
        }

        console.log('🛑 Stopping audio capture...');
        
        try {
            this.window.webContents.send('stopAudioCapture');
            this.isCapturing = false;
            
            ws.send(JSON.stringify({
                type: 'audioCaptureStopped',
                success: true
            }));
            
            console.log('✅ Audio capture stopped');
            
        } catch (error) {
            console.error('❌ Stop capture error:', error);
        }
    }

    setupIPC() {
        // Handle audio data from renderer
        ipcMain.on('audioData', (event, audioData) => {
            if (this.swiftAppConnected) {
                // Forward audio data to Swift app
                this.connectedClients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'audioData',
                            data: audioData,
                            timestamp: Date.now()
                        }));
                    }
                });
            }
        });

        // Handle transcription results from renderer
        ipcMain.on('transcriptionResult', (event, transcription) => {
            console.log('📝 Transcription:', transcription);
            
            // Send to all connected Swift apps
            this.connectedClients.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'transcription',
                        text: transcription,
                        timestamp: Date.now()
                    }));
                }
            });
        });

        // Handle interview coaching from renderer
        ipcMain.on('interviewCoaching', (event, coachingData) => {
            console.log('🎓 Interview Coaching:', coachingData.advice);
            
            // Send coaching advice to all connected Swift apps
            this.connectedClients.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'interviewCoaching',
                        advice: coachingData.advice,
                        originalTranscription: coachingData.originalTranscription,
                        timestamp: coachingData.timestamp
                    }));
                }
            });
        });
    }
}

// App lifecycle
app.whenReady().then(async () => {
    const companion = new CluelyAudioCompanion();
    await companion.initialize();
});

app.on('window-all-closed', () => {
    // Keep app running even when windows are closed (background service)
    console.log('🔄 Keeping audio companion running in background');
});

app.on('before-quit', () => {
    app.isQuiting = true;
});

app.on('activate', () => {
    // On macOS, show window when clicking dock icon
    if (BrowserWindow.getAllWindows().length === 0) {
        const companion = new CluelyAudioCompanion();
        companion.initialize();
    }
});

// Handle app termination
process.on('SIGINT', () => {
    console.log('🛑 Audio companion shutting down...');
    app.quit();
});

console.log('🚀 Cluely Audio Companion starting...'); 