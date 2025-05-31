// OpenAI Whisper API Configuration
// 
// TO USE REAL TRANSCRIPTION (like Cluely):
// 1. Get your API key from: https://platform.openai.com/api-keys
// 2. Add OPENAI_API_KEY to your .env file
// 3. Restart the Electron app

const config = {
    // OpenAI API Key - REQUIRED for real transcription AND interview coaching
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Set in .env file
    
    // IMPROVED: Whisper Model Settings for SPEED
    WHISPER_MODEL: 'whisper-1',
    WHISPER_LANGUAGE: 'en', // Specify language for faster processing
    
    // IMPROVED: GPT-4o Interview Coaching Settings for SPEED
    COACHING_MODEL: 'gpt-4o',
    COACHING_ENABLED: true,
    COACHING_MAX_TOKENS: 150, // Shorter responses for speed
    COACHING_TEMPERATURE: 0.3, // Lower for consistency
    
    // IMPROVED: Audio Settings for FASTER processing
    AUDIO_CHUNK_DURATION: 200, // REDUCED: 200ms chunks (was 1000ms)
    MIN_AUDIO_SIZE: 500, // REDUCED: 500 bytes (was 1024)
    
    // IMPROVED: Speech detection thresholds for FASTER response
    SILENCE_THRESHOLD: 800, // REDUCED: 0.8s silence (was 1.5s)
    MIN_SPEECH_DURATION: 500, // REDUCED: 0.5s minimum (was 0.8s)
    SPEECH_THRESHOLD: 0.01, // Optimized threshold
    
    // IMPROVED: Processing optimization
    MAX_TRANSCRIPTION_HISTORY: 5, // Track recent transcriptions
    TRANSCRIPTION_SIMILARITY_THRESHOLD: 0.8, // Duplicate detection
    PROCESSING_INTERVAL: 50 // Check speech every 50ms
};

module.exports = config; 