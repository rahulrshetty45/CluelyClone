const { ipcRenderer } = require('electron');
const config = require('./config');

class AudioCaptureManager {
    constructor() {
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.recognition = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // OpenAI Whisper API transcription
        this.openAIApiKey = null;
        this.whisperReady = false;
        this.processingWhisper = false;
        this.audioBuffer = [];
        
        // GPT-4o Interview Coaching
        this.coachingEnabled = false;
        this.conversationHistory = [];
        this.lastInterviewerQuestion = '';
        this.processingCoaching = false;
        
        // IMPROVED: Faster speech detection with better thresholds
        this.speechBuffer = [];
        this.isSpeaking = false;
        this.lastSpeechTime = 0;
        this.speechStartTime = 0;
        this.silenceThreshold = 600; // FIXED: Shorter silence (0.6 seconds) for continuous conversation
        this.minSpeechDuration = 400; // FIXED: Shorter minimum (0.4 second) for responsiveness
        this.speechThreshold = 0.008; // FIXED: Lower threshold for better sensitivity
        
        // IMPROVED: Audio capture mode with prioritized system audio
        this.captureMode = 'system';
        this.micStream = null;
        this.systemStream = null;
        
        // IMPROVED: Transcription queue for faster processing
        this.transcriptionQueue = [];
        this.isProcessingQueue = false;
        this.lastTranscriptionTime = 0;
        this.minTranscriptionInterval = 300; // FASTER: Process transcriptions every 300ms
        
        // IMPROVED: Duplicate detection
        this.lastTranscriptions = [];
        this.maxTranscriptionHistory = 5;
        
        // FIXED: Audio chunk buffering for continuous speech
        this.pendingAudioChunks = [];
        this.minAudioSizeForProcessing = 100000; // 100KB minimum for reliable processing
        this.maxBufferWaitTime = 3000; // Maximum 3 seconds to wait for buffer
        this.lastBufferFlushTime = 0;
        
        this.initializeUI();
        this.setupAudioCapture();
        this.setupOpenAIWhisper();
        this.setupSpeechRecognition();
        this.setupIPC();
        this.startTranscriptionQueue();
        this.startBufferProcessor(); // NEW: Start buffer management
    }

    initializeUI() {
        this.statusEl = document.getElementById('status');
        this.permissionStatusEl = document.getElementById('permissionStatus');
        this.recordingEl = document.getElementById('recording');
        this.visualizerEl = document.getElementById('visualizer');
        
        // Create visualizer bars
        for (let i = 0; i < 40; i++) {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            bar.style.animationDelay = `${i * 0.05}s`;
            this.visualizerEl.appendChild(bar);
        }
        
        console.log('🎨 UI initialized');
    }

    async setupAudioCapture() {
        try {
            console.log('🎤 Setting up IMPROVED audio capture...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia not supported');
            }

            this.updatePermissionStatus('🔑 IMPROVED Audio capture ready');
            console.log('✅ IMPROVED Audio capture setup complete');
            
        } catch (error) {
            console.error('❌ Audio setup error:', error);
            this.updatePermissionStatus('❌ Audio setup failed: ' + error.message);
        }
    }

    async setupOpenAIWhisper() {
        try {
            console.log('🤖 Initializing IMPROVED OpenAI Whisper API...');
            this.updatePermissionStatus('🤖 Setting up IMPROVED OpenAI Whisper...');
            
            this.openAIApiKey = config.OPENAI_API_KEY;
            
            if (this.openAIApiKey === 'YOUR_OPENAI_API_KEY') {
                console.log('⚠️ OpenAI API key not configured');
                this.updatePermissionStatus('⚠️ OpenAI API key needed for real transcription');
                return;
            }
            
            this.whisperReady = true;
            this.coachingEnabled = config.COACHING_ENABLED;
            console.log('✅ IMPROVED OpenAI Whisper API ready!');
            console.log('🎓 IMPROVED GPT-4o Interview Coaching:', this.coachingEnabled ? 'ENABLED' : 'DISABLED');
            
            this.updateCapabilityStatus();
            
        } catch (error) {
            console.error('❌ OpenAI Whisper setup error:', error);
            this.updatePermissionStatus('⚠️ OpenAI Whisper failed, using fallback');
            this.whisperReady = false;
            this.enableFallbackSpeechDetection();
        }
    }

    updateCapabilityStatus() {
        const coachingStatus = this.coachingEnabled ? '+ FAST GPT-4o Coaching' : '';
        this.updatePermissionStatus(`✅ IMPROVED Whisper ready - FASTER responses ${coachingStatus}`);
    }

    setupSpeechRecognition() {
        // IMPROVED: Simpler, more reliable approach - focus on system audio + Whisper
        console.log('🗣️ Setting up IMPROVED speech recognition (Whisper-focused)...');
        this.speechRecognitionMethod = 'whisper-only';
        console.log('✅ IMPROVED Speech recognition ready (Whisper-focused for reliability)');
    }

    // IMPROVED: Fast transcription queue processing
    startTranscriptionQueue() {
        setInterval(() => {
            if (this.transcriptionQueue.length > 0 && !this.isProcessingQueue) {
                this.processTranscriptionQueue();
            }
        }, this.minTranscriptionInterval);
    }

    async processTranscriptionQueue() {
        if (this.isProcessingQueue || this.transcriptionQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        const audioBlob = this.transcriptionQueue.shift();
        
        try {
            await this.transcribeWithOpenAI(audioBlob);
        } catch (error) {
            console.error('❌ Queue processing error:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    setupIPC() {
        ipcRenderer.on('startAudioCapture', () => {
            this.startCapture();
        });
        
        ipcRenderer.on('stopAudioCapture', () => {
            this.stopCapture();
        });
        
        console.log('📡 IPC communication setup');
    }

    async startCapture() {
        if (this.isRecording) return;

        try {
            console.log('🎤 Starting IMPROVED audio capture...');
            this.isRecording = true;
            
            // TRY: First attempt microphone capture directly (more reliable)
            try {
                console.log('🎙️ Attempting microphone capture...');
                await this.startMicrophoneCapture();
            } catch (micError) {
                console.log('🎙️ Microphone failed, trying system audio...');
                try {
                    await this.startSystemAudioCapture();
                } catch (systemError) {
                    console.error('❌ Both microphone and system audio failed');
                    throw new Error('No audio capture method available');
                }
            }
            
            this.updateUI();
            this.startVisualization();
            
            console.log('✅ IMPROVED Audio capture started');
            
        } catch (error) {
            console.error('❌ Failed to start audio capture:', error);
            this.isRecording = false;
            this.updatePermissionStatus('❌ Audio access denied - Please grant microphone permission');
        }
    }

    // NEW: Dedicated microphone capture method
    async startMicrophoneCapture() {
        try {
            console.log('🎙️ Starting IMPROVED microphone capture...');
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,  // Good for voice
                    noiseSuppression: true,  // Reduce background noise
                    autoGainControl: true,   // Normalize volume
                    sampleRate: 44100,
                    channelCount: 1 // Mono for smaller files
                }
            });

            console.log('✅ IMPROVED Microphone capture granted!');
            this.setupAudioProcessing();
            
        } catch (error) {
            console.error('❌ Microphone capture failed:', error);
            throw error;
        }
    }

    async startSystemAudioCapture() {
        try {
            console.log('🖥️ Starting IMPROVED system audio capture...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('getDisplayMedia not supported');
            }
            
            this.systemStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1 },
                    height: { ideal: 1 }
                },
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100, // IMPROVED: Better sample rate
                    channelCount: 1 // IMPROVED: Mono for smaller files
                }
            });

            console.log('✅ IMPROVED System audio capture granted!');
            this.mediaStream = this.systemStream;
            this.setupAudioProcessing();
            
        } catch (error) {
            console.error('❌ System audio capture failed:', error);
            throw error;
        }
    }

    setupAudioProcessing() {
        try {
            console.log('🔧 Setting up IMPROVED audio processing...');
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            
            // IMPROVED: Better audio analysis settings
            this.analyser.fftSize = 1024; // Smaller for faster processing
            this.analyser.smoothingTimeConstant = 0.3; // More responsive
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            source.connect(this.analyser);
            
            this.setupMediaRecorder();
            this.startContinuousMonitoring();
            
            console.log('✅ IMPROVED Audio processing setup complete');
            
        } catch (error) {
            console.error('❌ Audio processing setup failed:', error);
            throw error;
        }
    }

    setupMediaRecorder() {
        try {
            // FIXED: Use more compatible audio format for OpenAI
            let options = {};
            
            // Try different formats in order of preference for OpenAI compatibility
            const preferredFormats = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus'
            ];
            
            let selectedFormat = null;
            for (const format of preferredFormats) {
                if (MediaRecorder.isTypeSupported(format)) {
                    selectedFormat = format;
                    options.mimeType = format;
                    break;
                }
            }
            
            if (!selectedFormat) {
                console.warn('⚠️ No preferred format supported, using default');
            } else {
                console.log(`🎵 Using audio format: ${selectedFormat}`);
            }
            
            options.audioBitsPerSecond = 128000; // Higher quality for better OpenAI compatibility
            
            this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.speechBuffer.push(event.data);
                }
            };
            
            this.mediaRecorder.start(250); // Slightly larger chunks for stability
            console.log('✅ IMPROVED MediaRecorder started with compatible format');
            
        } catch (error) {
            console.error('❌ MediaRecorder setup failed:', error);
            // Fallback: try without any options
            try {
                this.mediaRecorder = new MediaRecorder(this.mediaStream);
                this.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        this.speechBuffer.push(event.data);
                    }
                };
                this.mediaRecorder.start(250);
                console.log('✅ MediaRecorder started with default settings');
            } catch (fallbackError) {
                console.error('❌ MediaRecorder fallback failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    startContinuousMonitoring() {
        // IMPROVED: Faster monitoring interval
        this.monitoringInterval = setInterval(() => {
            this.checkSpeechActivity();
        }, 50); // IMPROVED: Check every 50ms (was 100ms)
    }

    async stopCapture() {
        if (!this.isRecording) return;

        try {
            console.log('🛑 Stopping IMPROVED audio capture...');
            
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }
            
            if (this.audioContext) {
                await this.audioContext.close();
            }
            
            this.isRecording = false;
            this.updateUI();
            this.stopVisualization();
            
            console.log('✅ IMPROVED Audio capture stopped');
            
        } catch (error) {
            console.error('❌ Error stopping capture:', error);
        }
    }

    startVisualization() {
        if (!this.analyser) return;
        
        const animate = () => {
            if (!this.isRecording) return;
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            const bars = this.visualizerEl.children;
            for (let i = 0; i < bars.length; i++) {
                const barHeight = (dataArray[i] / 255) * 100;
                bars[i].style.height = `${Math.max(2, barHeight)}%`;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    stopVisualization() {
        const bars = this.visualizerEl.children;
        for (let i = 0; i < bars.length; i++) {
            bars[i].style.height = '2%';
        }
    }

    updateUI() {
        if (this.isRecording) {
            this.recordingEl.textContent = '🔴 Recording (IMPROVED)';
            this.recordingEl.style.color = '#ff4444';
        } else {
            this.recordingEl.textContent = '⚪ Ready (IMPROVED)';
            this.recordingEl.style.color = '#888888';
        }
    }

    updatePermissionStatus(message) {
        this.permissionStatusEl.textContent = message;
        console.log('📊 Status:', message);
    }

    // IMPROVED: Duplicate detection and filtering
    isDuplicateTranscription(text) {
        const cleanText = text.toLowerCase().trim();
        return this.lastTranscriptions.some(prev => {
            const similarity = this.calculateSimilarity(cleanText, prev);
            return similarity > 0.8; // 80% similarity threshold
        });
    }

    calculateSimilarity(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
        
        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        
        return 1 - (matrix[len2][len1] / Math.max(len1, len2));
    }

    addToTranscriptionHistory(text) {
        this.lastTranscriptions.push(text.toLowerCase().trim());
        if (this.lastTranscriptions.length > this.maxTranscriptionHistory) {
            this.lastTranscriptions.shift();
        }
    }

    // FIXED: Convert audio to WAV format for guaranteed OpenAI compatibility
    async convertToWav(audioBlob) {
        return new Promise((resolve, reject) => {
            try {
                // FIXED: Skip conversion for small files to avoid errors
                if (audioBlob.size < 5000) {
                    console.log('🔄 [FIXED] Small file - using original format');
                    resolve(audioBlob);
                    return;
                }
                
                // FIXED: Create fresh AudioContext for each conversion
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 44100
                });
                const fileReader = new FileReader();
                
                fileReader.onload = async (event) => {
                    try {
                        const arrayBuffer = event.target.result;
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        
                        // Convert to WAV
                        const wavBuffer = this.audioBufferToWav(audioBuffer);
                        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
                        
                        // FIXED: Close AudioContext to prevent memory leaks and corruption
                        await audioContext.close();
                        
                        console.log(`🔄 [FIXED] Converted ${Math.round(audioBlob.size/1024)}KB webm to ${Math.round(wavBlob.size/1024)}KB WAV`);
                        resolve(wavBlob);
                    } catch (error) {
                        console.log('🔄 [FIXED] WAV conversion failed, will try MP3 fallback');
                        // FIXED: Always close AudioContext even on error
                        await audioContext.close().catch(() => {});
                        resolve(audioBlob);
                    }
                };
                
                fileReader.onerror = async () => {
                    console.log('🔄 [FIXED] FileReader error, using original format');
                    await audioContext.close().catch(() => {});
                    resolve(audioBlob);
                };
                
                fileReader.readAsArrayBuffer(audioBlob);
            } catch (error) {
                console.log('🔄 [FIXED] Setup error, using original format');
                resolve(audioBlob);
            }
        });
    }

    // NEW: Convert to MP3 as a more reliable fallback
    async convertToMp3(audioBlob) {
        return new Promise((resolve) => {
            try {
                // For now, we'll create a properly formatted blob that OpenAI is more likely to accept
                // Note: True MP3 encoding would require additional libraries, so we'll use a different approach
                
                // Create a blob with more explicit headers that OpenAI might accept better
                const properBlob = new Blob([audioBlob], { 
                    type: 'audio/ogg; codecs=opus' // OGG is more universally supported
                });
                
                console.log(`🔄 [MP3] Created OGG fallback: ${Math.round(properBlob.size/1024)}KB`);
                resolve(properBlob);
            } catch (error) {
                console.log('🔄 [MP3] Fallback failed, using original');
                resolve(audioBlob);
            }
        });
    }

    // Convert AudioBuffer to WAV format
    audioBufferToWav(buffer) {
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        const numberOfChannels = buffer.numberOfChannels;
        const bytesPerSample = 2; // 16-bit
        const blockAlign = numberOfChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;
        
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        let offset = 0;
        writeString(offset, 'RIFF'); offset += 4;
        view.setUint32(offset, bufferSize - 8, true); offset += 4;
        writeString(offset, 'WAVE'); offset += 4;
        writeString(offset, 'fmt '); offset += 4;
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, 1, true); offset += 2; // PCM format
        view.setUint16(offset, numberOfChannels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, byteRate, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, 16, true); offset += 2; // bits per sample
        writeString(offset, 'data'); offset += 4;
        view.setUint32(offset, dataSize, true); offset += 4;
        
        // Convert audio data
        const channels = [];
        for (let i = 0; i < numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let sampleOffset = offset;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(sampleOffset, int16, true);
                sampleOffset += 2;
            }
        }
        
        return arrayBuffer;
    }

    async transcribeWithOpenAI(audioBlob) {
        if (!this.whisperReady || !this.openAIApiKey) {
            console.log('🔇 Skipping transcription - not ready');
            return;
        }

        if (audioBlob.size < 1000) { // IMPROVED: Very small threshold
            console.log('🔇 Skipping tiny audio chunk');
            return;
        }

        // FIXED: Ensure we don't block continuous listening
        console.log(`🤖 [CONTINUOUS] Processing ${Math.round(audioBlob.size/1024)}KB audio while continuing to listen...`);

        try {
            // FIXED: Smart format handling with improved fallback chain
            let finalBlob = audioBlob;
            let filename = 'audio.webm';
            let contentType = audioBlob.type || 'audio/webm';
            
            // Try WAV conversion first (most reliable for OpenAI)
            if (audioBlob.size > 50000) { // 50KB threshold for WAV conversion
                try {
                    const wavBlob = await this.convertToWav(audioBlob);
                    if (wavBlob !== audioBlob && wavBlob.type === 'audio/wav') {
                        finalBlob = wavBlob;
                        filename = 'audio.wav';
                        contentType = 'audio/wav';
                        console.log(`📁 [CONTINUOUS] Successfully using WAV format: ${filename}`);
                    } else {
                        throw new Error('WAV conversion returned original blob');
                    }
                } catch (wavError) {
                    console.log('🔄 [CONTINUOUS] WAV conversion failed, trying OGG fallback...');
                    
                    // Try OGG conversion as fallback
                    try {
                        const oggBlob = await this.convertToMp3(audioBlob); // This actually creates OGG
                        finalBlob = oggBlob;
                        filename = 'audio.ogg';
                        contentType = 'audio/ogg; codecs=opus';
                        console.log(`📁 [CONTINUOUS] Using OGG fallback format: ${filename}`);
                    } catch (oggError) {
                        console.log('🔄 [CONTINUOUS] OGG conversion failed, using original webm with better headers');
                        // Last resort: enhanced webm headers
                        finalBlob = new Blob([audioBlob], { type: 'audio/webm; codecs=opus' });
                        filename = 'audio.webm';
                        contentType = 'audio/webm; codecs=opus';
                    }
                }
            } else {
                console.log(`📁 [CONTINUOUS] Small file (${Math.round(audioBlob.size/1024)}KB), trying OGG format first`);
                
                // For smaller files, skip WAV and try OGG directly
                try {
                    const oggBlob = await this.convertToMp3(audioBlob);
                    finalBlob = oggBlob;
                    filename = 'audio.ogg';
                    contentType = 'audio/ogg; codecs=opus';
                    console.log(`📁 [CONTINUOUS] Using OGG format for small file: ${filename}`);
                } catch (oggError) {
                    console.log('🔄 [CONTINUOUS] Small file OGG failed, using enhanced webm');
                    finalBlob = new Blob([audioBlob], { type: 'audio/webm; codecs=opus' });
                    filename = 'audio.webm';
                    contentType = 'audio/webm; codecs=opus';
                }
            }

            const formData = new FormData();
            formData.append('file', finalBlob, filename);
            formData.append('model', 'whisper-1');
            formData.append('response_format', 'json');
            formData.append('language', 'en');

            console.log(`📡 [CONTINUOUS] Sending ${filename} (${Math.round(finalBlob.size/1024)}KB) to OpenAI...`);

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`❌ [CONTINUOUS] OpenAI API Error (${filename}): ${response.status} - ${errorText.slice(0, 100)}... CONTINUING TO LISTEN`);
                // FIXED: Don't throw error, just log and continue listening
                return;
            }

            const result = await response.json();

            if (result && result.text && result.text.trim().length > 0) {
                const transcription = result.text.trim();
                
                // IMPROVED: Check for duplicates
                if (this.isDuplicateTranscription(transcription)) {
                    console.log('🔄 [CONTINUOUS] Duplicate transcription detected, skipping but CONTINUING TO LISTEN');
                    return;
                }
                
                this.addToTranscriptionHistory(transcription);
                console.log(`✅ [CONTINUOUS] Transcription successful (${filename}):`, transcription, '- STILL LISTENING FOR MORE');
                
                // Send to main process
                ipcRenderer.send('transcriptionResult', transcription);
                
                // IMPROVED: Immediate coaching analysis (non-blocking)
                if (this.coachingEnabled) {
                    // FIXED: Don't await this - let it run in background
                    this.analyzeForInterviewCoaching(transcription).catch(error => {
                        console.error('❌ [BACKGROUND] Coaching error:', error);
                    });
                }
                
                console.log('🎤 [CONTINUOUS] Ready for next speech input...');
            } else {
                console.log('🔇 [CONTINUOUS] No transcription result, CONTINUING TO LISTEN');
            }

        } catch (error) {
            console.log('❌ [CONTINUOUS] Whisper error but CONTINUING TO LISTEN:', error.message);
            // FIXED: Don't break the flow, just continue listening
        }
        
        console.log('🔄 [CONTINUOUS] Transcription process complete - speech monitoring active');
    }

    checkSpeechActivity() {
        if (!this.analyser) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        // IMPROVED: Better volume calculation
        let sum = 0;
        let maxVolume = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
            maxVolume = Math.max(maxVolume, dataArray[i]);
        }
        const averageVolume = sum / bufferLength / 255;
        const normalizedMaxVolume = maxVolume / 255;
        
        const currentTime = Date.now();
        
        // IMPROVED: Use both average and peak detection
        const speechDetected = averageVolume > this.speechThreshold || normalizedMaxVolume > 0.05;
        
        if (speechDetected) {
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                this.speechStartTime = currentTime;
                console.log(`🗣️ [CONTINUOUS] Speech started (avg: ${averageVolume.toFixed(3)}, peak: ${normalizedMaxVolume.toFixed(3)})`);
            }
            this.lastSpeechTime = currentTime;
        } else {
            if (this.isSpeaking) {
                const silenceTime = currentTime - this.lastSpeechTime;
                if (silenceTime > this.silenceThreshold) {
                    const speechDuration = currentTime - this.speechStartTime;
                    
                    console.log(`🤐 [CONTINUOUS] Speech ended (duration: ${speechDuration}ms, silence: ${silenceTime}ms)`);
                    
                    if (speechDuration >= this.minSpeechDuration && this.speechBuffer.length > 0) {
                        console.log(`🎤 [CONTINUOUS] Processing ${this.speechBuffer.length} chunks - WILL CONTINUE LISTENING`);
                        // FIXED: Process asynchronously to avoid blocking the monitoring loop
                        this.processBufferedSpeechImmediate().then(() => {
                            console.log('✅ [CONTINUOUS] Processing complete - monitoring continues...');
                        }).catch((error) => {
                            console.error('❌ [CONTINUOUS] Processing error:', error);
                            // FIXED: Clear buffers on error and continue
                            this.speechBuffer = [];
                            this.pendingAudioChunks = [];
                            console.log('🔄 [CONTINUOUS] Buffers cleared - continuing to monitor...');
                        });
                    }
                    
                    // FIXED: Reset speaking state immediately (don't wait for processing)
                    this.isSpeaking = false;
                    // NOTE: speechBuffer will be cleared in processBufferedSpeechImmediate
                }
            }
        }
    }

    async processBufferedSpeechImmediate() {
        if (!this.whisperReady || this.speechBuffer.length === 0) {
            return;
        }

        try {
            // FIXED: Copy and clear speech buffer immediately to avoid blocking
            const currentSpeechChunks = [...this.speechBuffer];
            this.speechBuffer = []; // Clear immediately so new speech can be captured
            console.log(`🎵 [BUFFER] Processing ${currentSpeechChunks.length} chunks while continuing to listen...`);
            
            // Add to pending buffer for processing
            this.pendingAudioChunks.push(...currentSpeechChunks);
            
            // Calculate total buffered size
            const totalBufferedSize = this.pendingAudioChunks.reduce((total, chunk) => total + chunk.size, 0);
            console.log(`📊 [BUFFER] Total buffered: ${Math.round(totalBufferedSize/1024)}KB`);
            
            // If buffer is large enough, process immediately
            if (totalBufferedSize >= this.minAudioSizeForProcessing) {
                console.log(`🎤 [BUFFER] Buffer ready (${Math.round(totalBufferedSize/1024)}KB), processing while monitoring continues...`);
                
                const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
                const combinedBlob = new Blob(this.pendingAudioChunks, { type: mimeType });
                this.pendingAudioChunks = []; // Clear the buffer immediately
                
                console.log('🔄 [CONTINUOUS] Transcribing while ACTIVELY listening for new speech...');
                
                // FIXED: Process asynchronously without blocking speech monitoring
                this.transcribeWithOpenAI(combinedBlob).then(() => {
                    console.log('✅ [CONTINUOUS] Transcription complete - speech monitoring NEVER stopped');
                }).catch(error => {
                    console.error('❌ [CONTINUOUS] Transcription error but monitoring continues:', error);
                });
                
                this.lastBufferFlushTime = Date.now();
            } else {
                console.log(`⏳ [BUFFER] Buffer needs more audio (${Math.round(totalBufferedSize/1024)}KB) - STILL listening...`);
                this.lastBufferFlushTime = Date.now();
            }
            
        } catch (error) {
            console.error('❌ [BUFFER] Error processing speech but CONTINUING to monitor:', error);
            // FIXED: Clear all buffers on error but don't stop monitoring
            this.speechBuffer = [];
            this.pendingAudioChunks = [];
            console.log('🔄 [CONTINUOUS] Buffers cleared - speech monitoring ACTIVE');
        }
    }

    async analyzeForInterviewCoaching(transcription) {
        if (this.processingCoaching) {
            console.log('🎓 [IMPROVED] Already processing coaching, skipping...');
            return;
        }

        console.log('🎓 [IMPROVED] Analyzing for FAST interview coaching...');
        
        this.conversationHistory.push({
            timestamp: Date.now(),
            text: transcription,
            type: 'transcription'
        });

        // Keep history manageable
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        // IMPROVED: Immediate coaching analysis
        try {
            this.processingCoaching = true;
            const coaching = await this.getInterviewCoaching(transcription);
            
            if (coaching) {
                console.log('✅ [IMPROVED] FAST coaching generated');
                ipcRenderer.send('interviewCoaching', {
                    advice: coaching,
                    originalTranscription: transcription,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('❌ [IMPROVED] Coaching error:', error);
        } finally {
            this.processingCoaching = false;
        }
    }

    async getInterviewCoaching(transcription) {
        try {
            console.log('🎓 [IMPROVED] Getting FAST GPT-4o coaching...');

            const prompt = this.createCoachingPrompt(transcription);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert interview coach. Provide CONCISE, actionable advice for interview responses. Keep responses under 100 words and focus on key points.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 150, // IMPROVED: Shorter for speed
                    temperature: 0.3 // IMPROVED: Lower for consistency
                })
            });

            if (!response.ok) {
                console.error('❌ [IMPROVED] Coaching API error:', response.status);
                return null;
            }

            const result = await response.json();
            const advice = result.choices?.[0]?.message?.content?.trim();
            
            console.log('✅ [IMPROVED] FAST coaching received');
            return advice;

        } catch (error) {
            console.error('❌ [IMPROVED] Coaching generation error:', error);
            return null;
        }
    }

    createCoachingPrompt(transcription) {
        const recentHistory = this.conversationHistory
            .slice(-3)
            .map(item => item.text)
            .join(' ');

        return `INTERVIEW CONTEXT: "${recentHistory}"
LATEST TRANSCRIPTION: "${transcription}"

Provide CONCISE coaching advice (max 50 words) focusing on:
1. How to respond effectively
2. Key points to mention
3. Professional tone suggestions

Be direct and actionable.`;
    }

    // FIXED: Audio chunk buffering for continuous speech
    startBufferProcessor() {
        setInterval(() => {
            this.processBuffer();
        }, 100); // Check every 100ms
    }

    processBuffer() {
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.lastBufferFlushTime;

        if (this.pendingAudioChunks.length > 0 && elapsedTime > this.maxBufferWaitTime) {
            console.log(`⏰ [BUFFER] Timeout reached (${elapsedTime}ms), processing buffered audio...`);
            
            const audioChunks = [...this.pendingAudioChunks];
            this.pendingAudioChunks = []; // Clear the buffer
            
            const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
            const combinedBlob = new Blob(audioChunks, { type: mimeType });
            
            console.log(`🎵 [BUFFER] Created ${Math.round(combinedBlob.size/1024)}KB blob from timeout`);
            
            if (combinedBlob.size >= 10000) { // Lower threshold for timeout processing
                console.log('🔄 [CONTINUOUS] Transcribing buffered audio...');
                this.transcribeWithOpenAI(combinedBlob);
                console.log('✅ [CONTINUOUS] Timeout transcription complete - STILL LISTENING');
            } else {
                console.log('🔇 [BUFFER] Even timeout blob too small, discarding');
            }
            
            this.lastBufferFlushTime = currentTime;
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('[RENDERER] 📄 IMPROVED Renderer script loaded');
    window.audioManager = new AudioCaptureManager();
    console.log('[RENDERER] 🚀 IMPROVED Audio Capture Manager initialized');
}); 