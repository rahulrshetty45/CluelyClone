const { ipcRenderer } = require('electron');
const config = require('./config');

class AudioCaptureManager {
    constructor() {
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.isRecording = false;
        this.recognition = null;
        
        // FIXED: Web Audio API approach instead of MediaRecorder
        this.audioProcessor = null;
        this.audioSource = null;
        this.audioBuffer = [];
        this.bufferChunks = [];
        
        // OpenAI Whisper API transcription
        this.openAIApiKey = null;
        this.whisperReady = false;
        this.processingWhisper = false;
        
        // GPT-4o Interview Coaching
        this.coachingEnabled = false;
        this.conversationHistory = [];
        this.lastInterviewerQuestion = '';
        this.processingCoaching = false;
        
        // REAL-TIME: Enhanced speech detection
        this.speechBuffer = [];
        this.isSpeaking = false;
        this.lastSpeechTime = 0;
        this.speechStartTime = 0;
        this.silenceThreshold = 800; // OPTIMIZED: 800ms silence detection (was 1200ms) - faster but still allows pauses
        this.minSpeechDuration = 400; // OPTIMIZED: 400ms minimum speech (was 500ms)
        this.speechThreshold = 0.005; // Sensitivity threshold
        
        // REAL-TIME: WAV encoding settings
        this.sampleRate = 44100;
        this.bufferSize = 4096; // 4KB chunks for responsiveness
        this.chunkDuration = 3000; // OPTIMIZED: Send every 3 seconds for speed vs accuracy balance (was 8000)
        this.lastChunkTime = 0;
        
        // REAL-TIME: Transcription queue
        this.transcriptionQueue = [];
        this.isProcessingQueue = false;
        this.lastTranscriptionTime = 0;
        this.minTranscriptionInterval = 500; // Every 500ms
        
        // IMPROVED: Duplicate detection
        this.lastTranscriptions = [];
        this.maxTranscriptionHistory = 5;
        
        // NEW: Real-time visual feedback
        this.visualFeedbackEnabled = true;
        this.currentVolumeLevel = 0;
        this.voiceActivityIndicator = null;
        
        this.initializeUI();
        this.setupAudioCapture();
        this.setupOpenAIWhisper();
        this.setupIPC();
        this.startTranscriptionQueue();
        this.initializeRealTimeFeatures();
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
            console.log('🎤 Setting up REAL-TIME Web Audio API capture...');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia not supported');
            }

            this.updatePermissionStatus('🔑 REAL-TIME Web Audio API ready');
            console.log('✅ REAL-TIME Audio capture setup complete');
            
        } catch (error) {
            console.error('❌ Audio setup error:', error);
            this.updatePermissionStatus('❌ Audio setup failed: ' + error.message);
        }
    }

    async setupOpenAIWhisper() {
        try {
            console.log('🤖 Initializing REAL-TIME OpenAI Whisper API...');
            this.updatePermissionStatus('🤖 Setting up REAL-TIME OpenAI Whisper...');
            
            this.openAIApiKey = config.OPENAI_API_KEY;
            
            if (this.openAIApiKey === 'YOUR_OPENAI_API_KEY') {
                console.log('⚠️ OpenAI API key not configured');
                this.updatePermissionStatus('⚠️ OpenAI API key needed for real transcription');
                return;
            }
            
            this.whisperReady = true;
            this.coachingEnabled = config.COACHING_ENABLED;
            console.log('✅ REAL-TIME OpenAI Whisper API ready!');
            console.log('🎓 REAL-TIME GPT-4o Interview Coaching:', this.coachingEnabled ? 'ENABLED' : 'DISABLED');
            
            this.updateCapabilityStatus();
            
        } catch (error) {
            console.error('❌ OpenAI Whisper setup error:', error);
            this.updatePermissionStatus('⚠️ OpenAI Whisper failed');
            this.whisperReady = false;
        }
    }

    updateCapabilityStatus() {
        const coachingStatus = this.coachingEnabled ? '+ FAST GPT-4o Coaching' : '';
        this.updatePermissionStatus(`✅ REAL-TIME WAV → Whisper ready ${coachingStatus}`);
    }

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
            console.log('🎤 Starting REAL-TIME Web Audio API capture...');
            this.isRecording = true;
            
            // Get microphone access with high-quality settings
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.sampleRate,
                    channelCount: 1 // Mono for efficiency
                }
            });

            console.log('✅ Microphone access granted!');
            this.setupWebAudioAPI();
            
            this.updateUI();
            this.startVisualization();
            
            console.log('✅ REAL-TIME Web Audio API capture started');
            
        } catch (error) {
            console.error('❌ Failed to start audio capture:', error);
            this.isRecording = false;
            this.updatePermissionStatus('❌ Audio access denied - Please grant microphone permission');
        }
    }

    setupWebAudioAPI() {
        try {
            console.log('🔧 Setting up REAL-TIME Web Audio API processing...');
            
            // Create AudioContext with specified sample rate
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            // Create source from microphone stream
            this.audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 1024;
            this.analyser.smoothingTimeConstant = 0.3;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            
            // FIXED: Use ScriptProcessorNode for real-time PCM capture
            this.audioProcessor = this.audioContext.createScriptProcessor(
                this.bufferSize, // Buffer size
                1, // Input channels (mono)
                1  // Output channels (mono)
            );
            
            // Connect the audio pipeline
            this.audioSource.connect(this.analyser);
            this.audioSource.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);
            
            // REAL-TIME: Process audio data as it comes in
            this.audioProcessor.onaudioprocess = (event) => {
                this.processAudioChunk(event);
            };
            
            this.startContinuousMonitoring();
            
            console.log('✅ REAL-TIME Web Audio API processing setup complete');
            
        } catch (error) {
            console.error('❌ Web Audio API setup failed:', error);
            throw error;
        }
    }

    processAudioChunk(event) {
        // Get PCM audio samples from the input buffer
        const inputBuffer = event.inputBuffer;
        const samples = inputBuffer.getChannelData(0); // Mono channel
        
        // FIXED: Calculate audio energy to detect actual speech
        let energy = 0;
        for (let i = 0; i < samples.length; i++) {
            energy += samples[i] * samples[i];
        }
        energy = Math.sqrt(energy / samples.length);
        
        // FIXED: Only store chunks that have actual audio content
        const hasSignificantAudio = energy > 0.001; // Minimum energy threshold
        
        if (hasSignificantAudio) {
            this.bufferChunks.push(new Float32Array(samples));
        }
        
        // FIXED: Only process if we have voice activity AND audio content
        const currentTime = Date.now();
        if (currentTime - this.lastChunkTime >= this.chunkDuration) {
            // Only send if we have actual speech detected AND audio content
            if (this.isSpeaking && this.bufferChunks.length > 0) {
                this.processBufferedAudio();
            } else {
                // Clear empty buffers to prevent phantom transcriptions
                this.bufferChunks = [];
                console.log('🔇 [SILENCE] No speech detected - clearing buffer, not sending to OpenAI');
            }
            this.lastChunkTime = currentTime;
        }
    }

    async processBufferedAudio() {
        if (this.bufferChunks.length === 0 || !this.whisperReady) return;
        
        try {
            console.log(`🎵 [REAL-TIME] Converting ${this.bufferChunks.length} PCM chunks to WAV...`);
            
            // FIXED: Additional validation - check if the WAV has actual content
            const wavBlob = this.convertPCMToWAV(this.bufferChunks, this.sampleRate);
            
            // Clear the buffer for next chunk
            this.bufferChunks = [];
            
            if (wavBlob && wavBlob.size > 5000) { // INCREASED: Minimum 5KB for meaningful audio
                // FIXED: Validate audio content before sending
                if (await this.hasSignificantAudioContent(wavBlob)) {
                    console.log(`🎤 [REAL-TIME] Sending ${Math.round(wavBlob.size/1024)}KB WAV chunk to OpenAI...`);
                    this.transcriptionQueue.push(wavBlob);
                } else {
                    console.log(`🔇 [SILENT] Audio chunk has no significant content - skipping OpenAI call`);
                }
            } else {
                console.log('🔇 [REAL-TIME] Audio chunk too small, skipping...');
            }
            
        } catch (error) {
            console.error('❌ [REAL-TIME] Audio processing error:', error);
            this.bufferChunks = [];
        }
    }

    async hasSignificantAudioContent(wavBlob) {
        try {
            // Convert blob to array buffer and analyze audio content
            const arrayBuffer = await wavBlob.arrayBuffer();
            const dataView = new DataView(arrayBuffer);
            
            // Skip WAV header (44 bytes) and analyze audio data
            let maxAmplitude = 0;
            let totalEnergy = 0;
            let sampleCount = 0;
            
            for (let i = 44; i < arrayBuffer.byteLength; i += 2) {
                const sample = dataView.getInt16(i, true); // little endian
                const normalizedSample = Math.abs(sample) / 32768;
                maxAmplitude = Math.max(maxAmplitude, normalizedSample);
                totalEnergy += normalizedSample * normalizedSample;
                sampleCount++;
            }
            
            const avgEnergy = Math.sqrt(totalEnergy / sampleCount);
            const hasContent = maxAmplitude > 0.01 && avgEnergy > 0.005; // Thresholds for real speech
            
            console.log(`🔍 [AUDIO-CHECK] Max: ${maxAmplitude.toFixed(4)}, Avg: ${avgEnergy.toFixed(4)}, HasContent: ${hasContent}`);
            
            return hasContent;
            
        } catch (error) {
            console.error('❌ [AUDIO-CHECK] Error validating audio content:', error);
            return true; // If validation fails, proceed anyway
        }
    }

    convertPCMToWAV(pcmChunks, sampleRate) {
        if (pcmChunks.length === 0) return null;
        
        // Calculate total length
        const totalLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        
        // Merge all PCM chunks into single array
        const mergedPCM = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of pcmChunks) {
            mergedPCM.set(chunk, offset);
            offset += chunk.length;
        }
        
        // Convert float samples to 16-bit PCM
        const pcm16 = new Int16Array(totalLength);
        for (let i = 0; i < totalLength; i++) {
            const sample = Math.max(-1, Math.min(1, mergedPCM[i]));
            pcm16[i] = sample * 0x7FFF;
        }
        
        // Create WAV file structure
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcm16.length * 2, true);
        
        // Write PCM data
        const samples = new Uint8Array(buffer, 44);
        const pcmBytes = new Uint8Array(pcm16.buffer);
        samples.set(pcmBytes);
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    startContinuousMonitoring() {
        console.log('🎤 [REAL-TIME] Starting ultra-responsive voice monitoring...');
        
        // Monitor voice activity every 25ms for real-time feedback
        const monitorInterval = setInterval(() => {
            if (!this.isRecording) {
                clearInterval(monitorInterval);
                return;
            }
            this.checkSpeechActivity();
        }, 25);
        
        console.log('✅ [REAL-TIME] Voice monitoring active (25ms intervals)');
    }

    checkSpeechActivity() {
        if (!this.analyser) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate voice activity
        let sum = 0;
        let maxVolume = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
            maxVolume = Math.max(maxVolume, dataArray[i]);
        }
        const averageVolume = sum / bufferLength / 255;
        const normalizedMaxVolume = maxVolume / 255;
        
        const currentTime = Date.now();
        const speechDetected = averageVolume > this.speechThreshold || normalizedMaxVolume > 0.05;
        
        if (speechDetected) {
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                this.speechStartTime = currentTime;
                console.log(`🗣️ [REAL-TIME] Voice detected - continuous processing active`);
            }
            this.lastSpeechTime = currentTime;
            this.lastVolumeLevel = averageVolume; // Track volume for speech-end detection
        } else {
            if (this.isSpeaking) {
                const silenceTime = currentTime - this.lastSpeechTime;
                const speechDuration = currentTime - this.speechStartTime;
                
                // SMART: End speech faster if we had substantial speech duration
                const smartThreshold = speechDuration > 2000 ? 500 : this.silenceThreshold; // 500ms for longer speech
                
                if (silenceTime > smartThreshold) {
                    console.log(`🤐 [SMART-END] Voice ended after ${silenceTime}ms silence (${speechDuration}ms total speech) - processing now!`);
                    this.isSpeaking = false;
                    
                    // IMMEDIATE: Trigger processing if we have buffered content
                    if (this.bufferChunks.length > 0) {
                        console.log(`⚡ [IMMEDIATE] Processing buffered speech immediately`);
                        this.processBufferedAudio();
                        this.lastChunkTime = currentTime; // Reset chunk timer
                    }
                } else if (silenceTime > 300) {
                    // Brief pause detection (reduced logging)
                    if (silenceTime % 200 === 0) { // Log every 200ms to reduce spam
                        console.log(`⏸️ [PAUSE] Brief pause (${silenceTime}ms) - continuing...`);
                    }
                }
            }
        }
        
        // Update visual feedback
        this.updateVoiceActivityVisuals(averageVolume, normalizedMaxVolume);
    }

    async stopCapture() {
        if (!this.isRecording) return;

        try {
            console.log('🛑 Stopping REAL-TIME audio capture...');
            
            // Process any remaining buffered audio
            if (this.bufferChunks.length > 0) {
                await this.processBufferedAudio();
            }
            
            // Clean up Web Audio API
            if (this.audioProcessor) {
                this.audioProcessor.disconnect();
                this.audioProcessor = null;
            }
            
            if (this.audioSource) {
                this.audioSource.disconnect();
                this.audioSource = null;
            }
            
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                await this.audioContext.close();
                this.audioContext = null;
            }
            
            this.isRecording = false;
            this.bufferChunks = [];
            this.speechBuffer = [];
            
            this.updateUI();
            this.stopVisualization();
            
            console.log('✅ REAL-TIME Audio capture stopped');
            
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
            this.recordingEl.textContent = '🔴 Recording (REAL-TIME WAV)';
            this.recordingEl.style.color = '#ff4444';
        } else {
            this.recordingEl.textContent = '⚪ Ready (REAL-TIME WAV)';
            this.recordingEl.style.color = '#888888';
        }
    }

    updatePermissionStatus(message) {
        this.permissionStatusEl.textContent = message;
        console.log('📊 Status:', message);
    }

    isDuplicateTranscription(text) {
        const cleanText = text.toLowerCase().trim();
        return this.lastTranscriptions.some(prev => {
            const similarity = this.calculateSimilarity(cleanText, prev);
            return similarity > 0.8;
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

    async transcribeWithOpenAI(audioBlob) {
        console.log(`🎯 [TRANSCRIBE] Starting WAV transcription for ${Math.round(audioBlob.size/1024)}KB...`);
        
        if (!this.whisperReady || !this.openAIApiKey) {
            console.log('🔇 [TRANSCRIBE] Skipping - not ready or no API key');
            return;
        }

        if (audioBlob.size < 1000) {
            console.log('🔇 [TRANSCRIBE] Skipping tiny audio chunk');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav'); // WAV format!
            formData.append('model', 'whisper-1');
            formData.append('response_format', 'json');
            formData.append('language', 'en');

            console.log(`📡 [REAL-TIME] Sending WAV file (${Math.round(audioBlob.size/1024)}KB) to OpenAI...`);

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`
                },
                body: formData
            });

            console.log(`📊 [TRANSCRIBE] OpenAI response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`❌ [REAL-TIME] OpenAI API Error: ${response.status} - ${errorText.slice(0, 200)}...`);
                return;
            }

            const result = await response.json();

            if (result && result.text && result.text.trim().length > 0) {
                const transcription = result.text.trim();
                
                // Check for duplicates
                if (this.isDuplicateTranscription(transcription)) {
                    console.log('🔄 [REAL-TIME] Duplicate transcription detected, skipping');
                    return;
                }
                
                this.addToTranscriptionHistory(transcription);
                console.log(`✅ [REAL-TIME] WAV transcription successful:`, transcription);
                
                // Send to main process
                ipcRenderer.send('transcriptionResult', transcription);
                
                // Background coaching analysis
                if (this.coachingEnabled) {
                    this.analyzeForInterviewCoaching(transcription).catch(error => {
                        console.error('❌ [BACKGROUND] Coaching error:', error);
                    });
                }
            } else {
                console.log('🔇 [REAL-TIME] No transcription result');
            }

        } catch (error) {
            console.log('❌ [REAL-TIME] Whisper error:', error.message);
        }
    }

    async analyzeForInterviewCoaching(transcription) {
        if (this.processingCoaching) {
            console.log('🎓 Already processing coaching, skipping...');
            return;
        }

        // SMART FILTERING: Only coach meaningful interview-related speech
        if (!this.shouldProvideCoaching(transcription)) {
            console.log(`🎓 [FILTERED] Skipping coaching for: "${transcription}" (too casual/short)`);
            return;
        }

        console.log('🎓 Analyzing for TARGETED interview coaching...');
        
        this.conversationHistory.push({
            timestamp: Date.now(),
            text: transcription,
            type: 'transcription'
        });

        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        try {
            this.processingCoaching = true;
            const coaching = await this.getInterviewCoaching(transcription);
            
            if (coaching) {
                console.log('✅ TARGETED coaching generated');
                ipcRenderer.send('interviewCoaching', {
                    advice: coaching,
                    originalTranscription: transcription,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('❌ Coaching error:', error);
        } finally {
            this.processingCoaching = false;
        }
    }

    shouldProvideCoaching(transcription) {
        const text = transcription.trim().toLowerCase();
        
        // FILTER 1: Minimum length - must be at least 4 words or 15 characters
        const words = text.split(/\s+/).filter(word => word.length > 0);
        if (words.length < 4 || text.length < 15) {
            return false;
        }
        
        // FILTER 2: Casual/social words that don't need coaching
        const casualWords = [
            'oh', 'ah', 'um', 'uh', 'hmm', 'yeah', 'yes', 'no', 'okay', 'ok',
            'bye', 'hello', 'hi', 'thanks', 'thank you', 'you', 'me', 'i',
            'please', 'sorry', 'excuse me', 'pardon', 'what', 'huh'
        ];
        
        // If the entire transcription is just casual words, skip
        const nonCasualWords = words.filter(word => 
            !casualWords.includes(word) && 
            word.length > 2 && 
            !/^[a-z]{1,2}$/.test(word) // Skip very short words like "to", "is", "of"
        );
        
        if (nonCasualWords.length < 2) {
            return false;
        }
        
        // FILTER 3: Repetitive words (like "bye bye bye")
        const uniqueWords = [...new Set(words)];
        if (uniqueWords.length < words.length / 2) {
            return false; // Too repetitive
        }
        
        // FILTER 4: Look for interview-relevant content
        const interviewKeywords = [
            'experience', 'project', 'skill', 'challenge', 'team', 'manage', 'develop',
            'code', 'programming', 'software', 'technical', 'problem', 'solution',
            'work', 'company', 'role', 'responsibility', 'achievement', 'goal',
            'learn', 'improve', 'difficult', 'successful', 'failure', 'lesson',
            'algorithm', 'database', 'system', 'design', 'framework', 'language',
            'java', 'python', 'javascript', 'react', 'node', 'api', 'backend', 'frontend'
        ];
        
        const hasInterviewContent = words.some(word => 
            interviewKeywords.includes(word) ||
            word.length > 6 // Longer words are often more meaningful
        );
        
        // FILTER 5: Questions deserve coaching (they might be interview questions)
        const isQuestion = text.includes('?') || 
                          text.startsWith('what') || 
                          text.startsWith('how') || 
                          text.startsWith('why') || 
                          text.startsWith('when') || 
                          text.startsWith('where') ||
                          text.startsWith('tell me') ||
                          text.startsWith('describe') ||
                          text.startsWith('explain');
        
        return hasInterviewContent || isQuestion;
    }

    async getInterviewCoaching(transcription) {
        try {
            console.log('🎓 Getting FAST GPT-4o coaching...');

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
                    max_tokens: 150,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                console.error('❌ Coaching API error:', response.status);
                return null;
            }

            const result = await response.json();
            const advice = result.choices?.[0]?.message?.content?.trim();
            
            console.log('✅ FAST coaching received');
            return advice;

        } catch (error) {
            console.error('❌ Coaching generation error:', error);
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

    initializeRealTimeFeatures() {
        console.log('🚀 Initializing REAL-TIME WAV features...');
        
        this.createVoiceActivityIndicator();
        
        console.log('✅ REAL-TIME WAV features initialized');
    }

    createVoiceActivityIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'voice-activity-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(45deg, #1DB954, #1ed760);
            border: 3px solid rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            box-shadow: 0 4px 15px rgba(29, 185, 84, 0.3);
            transition: all 0.1s ease;
            opacity: 0.3;
            z-index: 1000;
        `;
        indicator.textContent = '🎤';
        document.body.appendChild(indicator);
        this.voiceActivityIndicator = indicator;
    }

    updateVoiceActivityVisuals(voiceLevel, peakLevel) {
        if (!this.voiceActivityIndicator) return;
        
        const intensity = Math.min(voiceLevel * 10, 1);
        const scale = 1 + (intensity * 0.3);
        const opacity = 0.3 + (intensity * 0.7);
        
        let color = '#1DB954';
        if (intensity > 0.7) {
            color = '#ff6b6b';
        } else if (intensity > 0.4) {
            color = '#ffd93d';
        }
        
        this.voiceActivityIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(45deg, ${color}, ${color}dd);
            border: 3px solid rgba(255,255,255,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            box-shadow: 0 4px 15px ${color}66;
            transition: all 0.1s ease;
            opacity: ${opacity};
            transform: scale(${scale});
            z-index: 1000;
        `;
        
        if (this.isSpeaking) {
            this.voiceActivityIndicator.textContent = '🗣️';
        } else if (intensity > 0.2) {
            this.voiceActivityIndicator.textContent = '👂';
            } else {
            this.voiceActivityIndicator.textContent = '🎤';
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('[RENDERER] 📄 REAL-TIME WAV Renderer script loaded');
    window.audioManager = new AudioCaptureManager();
    console.log('[RENDERER] 🚀 REAL-TIME WAV Audio Capture Manager initialized');
}); 