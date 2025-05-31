# 🎯 Cluely Interview Assistant

A real-time AI interview coaching system that provides instant feedback and coding help during technical interviews.

## ✨ Features

- **🎤 Real-time Voice Analysis**: Continuous audio transcription and AI coaching
- **⚡ Instant Screen Analysis**: Press Cmd+Enter to get AI help on anything on screen
- **🤖 GPT-4o Integration**: Intelligent responses with proper code formatting
- **👁 Screenshot Hiding**: Invisible to screen capture (like original Cluely)
- **⌨️ Global Hotkeys**: Control from anywhere on your system
- **📱 Modern UI**: Floating interface that works across all applications
- **🔄 Dynamic Resizing**: Text containers adapt to content length
- **📋 Easy Copy**: One-click copying of AI responses

## 🚀 Quick Start

### Simple 4-Step Setup

1. **📥 Download this project**
   ```bash
   git clone <repository-url>
   cd Cluely-Interview-Assistant
   ```

2. **📋 Install requirements** (see `requirements.txt` for details)
   ```bash
   # Install Node.js if needed (from https://nodejs.org or via Homebrew)
   brew install node
   
   # Install project dependencies
   cd electron-audio-companion
   npm install
   cd ..
   
   # Set up your OpenAI API key
   cp .env.example .env
   # Edit .env and add: OPENAI_API_KEY=your_key_here
   ```

3. **🎧 Run the audio server**
   ```bash
   cd electron-audio-companion && npm start
   ```

4. **🚀 Run the main app** (in a new terminal)
   ```bash
   swift cluely_ui_replica.swift
   ```

**That's it!** Use `Cmd+Shift+\` to show/hide the interface.

---

### Prerequisites

- macOS (required for Swift and screen capture)
- Node.js and npm
- OpenAI API key

## 🎮 Usage

### Global Hotkeys
- **Cmd+Shift+\\** - Show/hide interface
- **Cmd+Enter** - Analyze whatever is currently on screen (instant AI help!)
- **Cmd+Arrow Keys** - Move interface window around the screen
- **🎤 Coach button** - Start/stop real-time voice coaching

### Interface Controls
- **💬 Chat** - Analyze current screen content
- **↻ Start Over** - Reset session and clear responses  
- **👁 Show/Hide** - Toggle interface visibility
- **🎤 Coach** - Start/stop real-time voice coaching
- **⋯ More** - Additional options

### Real-time Voice Coaching
1. Click the **🎤 Coach** button to start listening
2. Speak your interview questions or responses
3. Get instant AI feedback with:
   - Suggested responses
   - Key points to mention
   - Code examples (properly formatted)
   - Delivery tips

## 🔧 Configuration

Edit `.env` file to customize:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional (with defaults)
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=150
OPENAI_TEMPERATURE=0.7
OCR_INTERVAL_SECONDS=3.0
OCR_MIN_TEXT_LENGTH=20
```

## 📁 Project Structure

```
Cluely-Interview-Assistant/
├── cluely_ui_replica.swift      # Main Swift UI application
├── electron-audio-companion/    # Audio capture system
│   ├── package.json
│   ├── main.js
│   ├── renderer-improved.js
│   ├── index.html
│   └── config.js
├── .env.example                 # Environment template
└── README.md                    # This file
```

## 🛠 Technical Details

### Architecture
- **Swift UI**: Main floating interface with screen capture and OCR
- **Electron**: Audio capture and real-time transcription
- **WebSocket**: Communication between Swift and Electron
- **OpenAI GPT-4o**: AI analysis and response generation

### Privacy & Security
- Screenshot hiding prevents detection during interviews
- Audio processing happens locally
- Only transcribed text sent to OpenAI API
- No permanent storage of audio or conversations

## 🐛 Troubleshooting

### Common Issues

**"System not responding initially"**
- If the app doesn't work right away, try this quick fix:
  1. Click the **🎤 Coach** button to stop recording
  2. Click **↻ Start Over** button 
  3. Click **🎤 Coach** again to restart
- This resets the audio system and usually fixes initialization issues

**"No audio capture"**
- Grant microphone permissions to Terminal/your IDE
- Check that Electron companion is running (`npm start`)

**"No AI responses"**  
- Verify OpenAI API key in `.env` file
- Check internet connection
- Ensure API key has sufficient credits

**"Interface not visible"**
- Try Cmd+Shift+\\ to toggle visibility
- Check if window moved off-screen (use Cmd+Arrow keys)

**"WebSocket connection failed"**
- Restart the Electron companion (`npm start`)
- Wait a few seconds for Swift app to reconnect

## 📝 License

This project is for educational purposes. Please ensure compliance with interview policies and terms of service for any platforms you use.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚠️ Disclaimer

This tool is designed to assist with interview preparation and coding practice. Always follow your interview platform's terms of service and ethical guidelines. Use responsibly and transparently where appropriate. 