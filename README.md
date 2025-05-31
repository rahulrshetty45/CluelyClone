# 🎯 Cluely Interview Assistant - My Recreation   (Hopefully this makes me cracked enough for that internship)

Hey Cluely team,

I built this as my own take on your interview assistant concept. Figured the best way to understand how it works was to recreate it from scratch using Swift and Electron. Knocked this out in 12 hours to show what I can build and how I approach reverse-engineering existing products.

## ✨ What I Built

- **🎤 Real-time Voice Analysis**: Audio transcription with AI coaching feedback
- **⚡ Instant Screen Analysis**: Press Cmd+Enter for AI help on screen content
- **🤖 GPT-4o Integration**: Smart responses with code formatting
- **🔒 Screenshot Hiding**: The invisible-to-screen-capture feature
- **⌨️ Global Hotkeys**: System-wide controls
- **📱 Modern UI**: Floating interface that works across all apps


## 🔒 Screenshot Hiding Implementation

### How I Built It

The core feature is making the window invisible to screen capture while keeping it visible to the user. Pretty straightforward implementation:

```swift
window.sharingType = .none  // Excludes window from screen capture APIs
```

**What this does:**
- Invisible to screenshot tools and screen recordings
- Works with video calls (Zoom, Teams, etc.)
- User sees it normally, capture software doesn't
- No setup required

### Technical Details

**Automatic hiding:**
- Uses macOS window sharing APIs
- Excluded from all screen capture methods
- Seamless integration with video conferencing

**Manual controls:**
- `Cmd+Shift+\` hotkey for manual hide/show
- Transparency-based hiding
- Process stays alive when hidden

### Features Overview

| Feature | What It Does | Status |
|---------|--------------|---------|
| Screenshot hiding | Invisible to capture | Always on |
| Manual hiding | User toggle | On demand |
| Cross-desktop | Works on all spaces | Always on |
| Always on top | Floats above windows | Always on |
| Clean design | Borderless interface | Always on |

### Use Cases

Built for:
- Remote technical interviews
- Coding assessments
- Online coding challenges  
- Screen sharing scenarios

This was a fun technical challenge to figure out the window management and capture exclusion APIs.

## 🚀 Quick Start

Want to try it out? Here's how to get it running:

### 1. Clone and Setup
```bash
git clone [this-repo]
cd Cluely-Interview-Assistant
```

### 2. Install Requirements
```bash
# Install Node.js dependencies for audio capture
cd electron-audio-companion
npm install
cd ..

# Set up your OpenAI API key
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=your_key_here
```

### 3. Start the Audio Server
```bash
cd electron-audio-companion
npm start
```

### 4. Run the Swift App (in a new terminal)
```bash
swift cluely_ui_replica.swift
```

That's it! Use `Cmd+Shift+\` to show/hide the interface.

**Prerequisites:**
- macOS (for Swift and screen capture APIs)
- Node.js
- OpenAI API key

## 🎮 How to Use It

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
