// Load environment variables from .env file
require('dotenv').config();

// OpenAI Whisper API Configuration
// 
// TO USE REAL TRANSCRIPTION (like Cluely):
// 1. Get your API key from: https://platform.openai.com/api-keys
// 2. Add OPENAI_API_KEY to your .env file
// 3. Restart the Electron app

const config = {
    // OpenAI API Key - REQUIRED for real transcription AND interview coaching
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Set in .env file
    
    // REAL-TIME: Whisper Model Settings for ULTRA-FAST processing
    WHISPER_MODEL: 'whisper-1',
    WHISPER_LANGUAGE: 'en', // Specify language for faster processing
    
    // REAL-TIME: GPT-4o Interview Coaching Settings for INSTANT feedback
    COACHING_MODEL: 'gpt-4o',
    COACHING_ENABLED: true,
    COACHING_MAX_TOKENS: 100, // FASTER: Even shorter responses (was 150)
    COACHING_TEMPERATURE: 0.2, // LOWER: More consistent for real-time (was 0.3)
    
    // REAL-TIME: Audio Settings for INSTANT processing
    AUDIO_CHUNK_DURATION: 100, // ULTRA-FAST: 100ms chunks (was 200ms)
    MIN_AUDIO_SIZE: 200, // ULTRA-FAST: 200 bytes (was 500)
    
    // REAL-TIME: Speech detection thresholds for INSTANT response
    SILENCE_THRESHOLD: 300, // ULTRA-FAST: 0.3s silence (was 800ms)
    MIN_SPEECH_DURATION: 200, // ULTRA-FAST: 0.2s minimum (was 500ms)
    SPEECH_THRESHOLD: 0.005, // ULTRA-SENSITIVE: Lower threshold (was 0.01)
    
    // REAL-TIME: Processing optimization for 40 FPS monitoring
    MAX_TRANSCRIPTION_HISTORY: 5, // Track recent transcriptions
    TRANSCRIPTION_SIMILARITY_THRESHOLD: 0.8, // Duplicate detection
    PROCESSING_INTERVAL: 25, // ULTRA-FAST: Check speech every 25ms (40 FPS)
    
    // NEW: Real-time streaming settings
    STREAMING_ENABLED: true,
    STREAMING_CHUNK_SIZE: 100, // Process every 100ms
    VOICE_ACTIVITY_DETECTION: true,
    CONTINUOUS_LISTENING: true,
    
    // NEW: Visual feedback settings
    VISUAL_FEEDBACK_ENABLED: true,
    VOICE_FREQUENCY_RANGE: [300, 3000], // Human voice frequencies
    VOICE_ACTIVITY_WINDOW: 10 // Smooth voice detection over 10 samples
};

module.exports = config; 