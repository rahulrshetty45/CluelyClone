#!/usr/bin/env swift

import Cocoa
import Foundation
import Vision
import ScreenCaptureKit
import AVFoundation
import Speech

/**
 * Cluely UI Replica - Exact Interface Recreation with AI Integration
 * 
 * This recreates the exact floating interface design from the original Cluely,
 * including the horizontal bar layout, dark theme, and all UI elements.
 * 
 * Features:
 * - Global hotkey: Cmd+Shift+\ to show/hide
 * - Window movement: Cmd + Arrow keys
 * - Screenshot hiding
 * - Screen OCR (Vision framework)
 * - GPT-4o API integration
 * - Interview Coaching via Electron Audio Companion
 */

class CluelyUIDelegate: NSObject, NSApplicationDelegate, SCStreamDelegate, URLSessionWebSocketDelegate {
    var window: NSWindow!
    var timer: Timer?
    var elapsedTime: Int = 0
    var isHidden: Bool = false
    var globalEventMonitor: Any?
    
    // AI Integration Properties - loaded from .env file
    private var openAIAPIKey: String = ""
    private var openAIModel: String = "gpt-4o"
    private var maxTokens: Int = 150
    private var temperature: Double = 0.7
    private var ocrInterval: Double = 3.0
    private var minTextLength: Int = 20
    
    // Debug mode
    private let debugMode: Bool = false // Set to false for production
    
    private var lastScreenText: String = ""
    private var isProcessingAI: Bool = false
    private var currentAITask: Task<Void, Never>? // Track current AI request for cancellation
    
    // AI Response UI Components
    private var responseContainer: NSView!
    private var responseTextView: NSTextView!
    private var isResponseVisible: Bool = false
    
    // Dynamic sizing properties
    private let minResponseHeight: CGFloat = 100
    private let maxResponseHeight: CGFloat = 400
    private let responseTextPadding: CGFloat = 36 // 18 top + 18 bottom
    
    // Audio capture properties - now connects to Electron companion
    private var electronWebSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var isListening: Bool = false
    private var lastTranscribedText: String = ""
    private var lastCoachingAdvice: String = ""
    
    // Interview coaching state
    private var interviewMode: Bool = false
    private var conversationHistory: [String] = []
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {
        print("🚀 Launching Cluely UI Replica with AI...")
        
        // Load configuration from .env file
        loadEnvironmentConfiguration()
        
        createCluelyInterface()
        applyScreenshotHiding()
        setupGlobalHotkey()
        startTimer()
        
        // Connect to Electron Audio Companion for interview coaching
        connectToElectronCompanion()
        
        // Only show AI status if API key is configured
        if !openAIAPIKey.isEmpty {
            print("✅ Cluely interface ready with GPT-4o streaming!")
            print("🎓 Interview coaching via Electron Audio Companion")
            print("🎤 Press microphone button for real-time interview advice")
        } else {
            print("⚠️  Cluely interface ready (AI disabled - no API key)")
            print("💡 Create .env file with OPENAI_API_KEY to enable AI features")
        }
        
        print("⌨️  Press Cmd+Shift+\\ to show/hide interface")
        print("📱 White background AI responses for better visibility")
        
        // Note: Audio capture now handled by Electron Audio Companion
        print("🎤 Audio capture delegated to Electron Audio Companion")
    }
    
    private func loadEnvironmentConfiguration() {
        // Try to load .env file from current directory
        let envPath = FileManager.default.currentDirectoryPath + "/.env"
        
        guard let envContent = try? String(contentsOfFile: envPath, encoding: .utf8) else {
            print("⚠️  No .env file found. Copy env_example.txt to .env and configure your API key.")
            return
        }
        
        // Parse .env file
        let lines = envContent.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                continue // Skip empty lines and comments
            }
            
            let parts = trimmed.components(separatedBy: "=")
            guard parts.count >= 2 else { continue }
            
            let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
            let value = parts[1...].joined(separator: "=").trimmingCharacters(in: .whitespacesAndNewlines)
            
            switch key {
            case "OPENAI_API_KEY":
                openAIAPIKey = value
                print("🔑 OpenAI API key loaded from .env")
            case "OPENAI_MODEL":
                openAIModel = value
            case "OPENAI_MAX_TOKENS":
                maxTokens = Int(value) ?? 150
            case "OPENAI_TEMPERATURE":
                temperature = Double(value) ?? 0.7
            case "OCR_INTERVAL_SECONDS":
                ocrInterval = Double(value) ?? 3.0
            case "OCR_MIN_TEXT_LENGTH":
                minTextLength = Int(value) ?? 20
            default:
                break
            }
        }
    }
    
    private func createCluelyInterface() {
        // Create horizontal floating bar (adjusted size for interview coaching button)
        window = NSWindow(
            contentRect: NSMakeRect(100, 100, 480, 50),
            styleMask: [.borderless], // No title bar like Cluely
            backing: .buffered,
            defer: false
        )
        
        // Cluely's window properties - TRULY GLOBAL
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.maximumWindow)) + 1)  // Above everything
        window.backgroundColor = NSColor.clear
        window.isOpaque = false
        window.hasShadow = true
        window.ignoresMouseEvents = false
        
        // CRITICAL: Make window appear on ALL spaces and apps
        window.collectionBehavior = [
            .canJoinAllSpaces,           // Appears on all spaces/desktops
            .stationary,                 // Stays in same position across spaces
            .ignoresCycle                // Doesn't appear in Cmd+Tab
        ]
        
        // Create main container with dark rounded background
        let containerView = createMainContainer()
        window.contentView = containerView
        
        // Position window (top-center like Cluely)
        if let screen = NSScreen.main {
            let screenFrame = screen.visibleFrame
            let windowFrame = window.frame
            let x = (screenFrame.width - windowFrame.width) / 2
            let y = screenFrame.maxY - windowFrame.height - 20
            window.setFrameOrigin(NSPoint(x: x, y: y))
        }
        
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        
        print("🌍 Window configured for ALL spaces and applications")
    }
    
    private func createMainContainer() -> NSView {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 50))
        container.wantsLayer = true
        
        // Modern glassmorphism background with subtle blur effect
        container.layer?.backgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 0.85).cgColor
        container.layer?.cornerRadius = 12
        container.layer?.borderWidth = 0.5
        container.layer?.borderColor = NSColor(white: 1.0, alpha: 0.15).cgColor
        
        // Modern shadow with multiple layers for depth
        container.layer?.shadowOpacity = 0.25
        container.layer?.shadowOffset = CGSize(width: 0, height: 4)
        container.layer?.shadowRadius = 12
        container.layer?.shadowColor = NSColor.black.cgColor
        
        // Add all UI elements in Cluely's order with improved spacing
        addChatButton(to: container)
        addStartOverButton(to: container)
        addShowHideButton(to: container)
        addTimerDisplay(to: container)
        addMicrophoneButton(to: container)
        addMoreOptionsButton(to: container)
        
        // Add AI response container (initially hidden)
        createAIResponseContainer(in: container)
        
        return container
    }
    
    private func createAIResponseContainer(in container: NSView) {
        // Put response ABOVE main bar with modern positioning
        responseContainer = NSView(frame: NSRect(x: 8, y: 52, width: 464, height: 120))
        responseContainer.wantsLayer = true
        responseContainer.isHidden = true
        
        // Modern glassmorphism with enhanced blur effect
        responseContainer.layer?.backgroundColor = NSColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 0.85).cgColor
        responseContainer.layer?.cornerRadius = 12
        responseContainer.layer?.borderWidth = 0.5
        responseContainer.layer?.borderColor = NSColor(white: 1.0, alpha: 0.15).cgColor
        
        // Enhanced shadow for modern depth
        responseContainer.layer?.shadowOpacity = 0.4
        responseContainer.layer?.shadowOffset = CGSize(width: 0, height: 6)
        responseContainer.layer?.shadowRadius = 20
        responseContainer.layer?.shadowColor = NSColor.black.cgColor
        
        // AI Response header with modern typography
        let headerLabel = NSTextField(frame: NSRect(x: 18, y: 92, width: 200, height: 20))
        headerLabel.stringValue = "🤖 AI Response"
        headerLabel.isEditable = false
        headerLabel.isBordered = false
        headerLabel.drawsBackground = false
        headerLabel.textColor = NSColor(red: 0.4, green: 0.8, blue: 1.0, alpha: 1.0)
        headerLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        responseContainer.addSubview(headerLabel)
        
        // FIXED: Create scroll view to properly handle long content
        let scrollView = NSScrollView(frame: NSRect(x: 18, y: 18, width: 428, height: 68))
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.scrollerStyle = .overlay
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false
        
        // Response text view with modern styling
        responseTextView = NSTextView(frame: NSRect(x: 0, y: 0, width: 428, height: 68))
        responseTextView.string = "Loading AI response..."
        responseTextView.isEditable = false
        responseTextView.isSelectable = true
        responseTextView.drawsBackground = false
        responseTextView.textColor = NSColor(white: 0.95, alpha: 1.0)
        responseTextView.font = NSFont.systemFont(ofSize: 14, weight: .regular)
        responseTextView.isAutomaticQuoteSubstitutionEnabled = false
        responseTextView.isRichText = true
        responseTextView.wantsLayer = true
        
        // FIXED: Better text container settings for scrolling content
        responseTextView.textContainer?.lineFragmentPadding = 8
        responseTextView.textContainer?.widthTracksTextView = true
        responseTextView.textContainer?.heightTracksTextView = false
        responseTextView.textContainer?.containerSize = NSSize(width: 428, height: CGFloat.greatestFiniteMagnitude)
        
        // Modern inner border with subtle glow on scroll view
        scrollView.wantsLayer = true
        scrollView.layer?.borderWidth = 0.5
        scrollView.layer?.borderColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        scrollView.layer?.cornerRadius = 8
        scrollView.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.03).cgColor
        
        // Add subtle inner shadow for depth
        scrollView.layer?.shadowOpacity = 0.2
        scrollView.layer?.shadowOffset = CGSize(width: 0, height: 1)
        scrollView.layer?.shadowRadius = 3
        scrollView.layer?.shadowColor = NSColor.black.cgColor
        
        // FIXED: Properly set up the scroll view with text view
        scrollView.documentView = responseTextView
        responseContainer.addSubview(scrollView)
        
        // Modern copy button
        let copyButton = NSButton(frame: NSRect(x: 370, y: 92, width: 70, height: 20))
        copyButton.title = "📋 Copy"
        copyButton.bezelStyle = .rounded
        copyButton.controlSize = .small
        copyButton.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        copyButton.contentTintColor = NSColor(white: 0.9, alpha: 1.0)
        copyButton.wantsLayer = true
        
        // Glass-like button effect
        copyButton.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        copyButton.layer?.cornerRadius = 6
        copyButton.layer?.borderWidth = 0.5
        copyButton.layer?.borderColor = NSColor(white: 1.0, alpha: 0.15).cgColor
        copyButton.layer?.shadowOpacity = 0.1
        copyButton.layer?.shadowOffset = CGSize(width: 0, height: 1)
        copyButton.layer?.shadowRadius = 2
        
        copyButton.target = self
        copyButton.action = #selector(copyResponseClicked)
        responseContainer.addSubview(copyButton)
        
        container.addSubview(responseContainer, positioned: .above, relativeTo: nil)
        
        // Debug mode: Force container to be visible for testing
        if debugMode {
            print("🐛 DEBUG MODE: Forcing response container to be visible")
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                let debugText = "🐛 DEBUG: This is test text to verify visibility and dynamic resizing functionality. This text should make the container grow to accommodate the longer content automatically."
                self.responseContainer.isHidden = false
                
                let formattedDebugText = self.formatAIResponseText(debugText)
                self.responseTextView.textStorage?.setAttributedString(formattedDebugText)
                
                // Calculate and apply dynamic height for debug text
                let requiredHeight = self.calculateRequiredHeight(for: debugText)
                self.resizeResponseContainer(to: requiredHeight)
                
                // Force all layout updates
                self.responseContainer.needsLayout = true
                self.responseContainer.needsDisplay = true
                self.responseTextView.layoutManager?.ensureLayout(for: self.responseTextView.textContainer!)
                self.responseTextView.needsDisplay = true
                
                self.isResponseVisible = true
                
                print("🐛 DEBUG: Response container should now be visible with dynamic height: \(requiredHeight)")
            }
        }
    }
    
    private func addChatButton(to container: NSView) {
        let button = NSButton(frame: NSRect(x: 15, y: 13, width: 55, height: 24))
        button.title = "💬 Chat"
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        button.wantsLayer = true
        
        // Modern gradient background
        let gradient = CAGradientLayer()
        gradient.frame = button.bounds
        gradient.colors = [
            NSColor(red: 0.1, green: 0.6, blue: 1.0, alpha: 1.0).cgColor,
            NSColor(red: 0.0, green: 0.45, blue: 0.9, alpha: 1.0).cgColor
        ]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 0, y: 1)
        gradient.cornerRadius = 8
        
        button.layer?.insertSublayer(gradient, at: 0)
        button.layer?.cornerRadius = 8
        button.layer?.shadowOpacity = 0.3
        button.layer?.shadowOffset = CGSize(width: 0, height: 2)
        button.layer?.shadowRadius = 4
        button.layer?.shadowColor = NSColor(red: 0.0, green: 0.45, blue: 0.9, alpha: 1.0).cgColor
        
        button.contentTintColor = .white
        button.target = self
        button.action = #selector(chatClicked)
        container.addSubview(button)
    }
    
    private func addStartOverButton(to container: NSView) {
        let button = NSButton(frame: NSRect(x: 80, y: 13, width: 75, height: 24))
        button.title = "↻ Start Over"
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        button.contentTintColor = NSColor(white: 0.95, alpha: 1.0)
        button.wantsLayer = true
        
        // Modern glass-like button background
        button.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        button.layer?.cornerRadius = 6
        button.layer?.borderWidth = 0.5
        button.layer?.borderColor = NSColor(white: 1.0, alpha: 0.12).cgColor
        
        // Subtle shadow for depth
        button.layer?.shadowOpacity = 0.15
        button.layer?.shadowOffset = CGSize(width: 0, height: 1)
        button.layer?.shadowRadius = 2
        button.layer?.shadowColor = NSColor.black.cgColor
        
        button.target = self
        button.action = #selector(startOverClicked)
        container.addSubview(button)
    }
    
    private func addShowHideButton(to container: NSView) {
        let button = NSButton(frame: NSRect(x: 165, y: 13, width: 75, height: 24))
        button.title = "👁 Show/Hide"
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        button.contentTintColor = NSColor(white: 0.95, alpha: 1.0)
        button.wantsLayer = true
        
        // Modern glass-like button background
        button.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        button.layer?.cornerRadius = 6
        button.layer?.borderWidth = 0.5
        button.layer?.borderColor = NSColor(white: 1.0, alpha: 0.12).cgColor
        
        // Subtle shadow for depth
        button.layer?.shadowOpacity = 0.15
        button.layer?.shadowOffset = CGSize(width: 0, height: 1)
        button.layer?.shadowRadius = 2
        button.layer?.shadowColor = NSColor.black.cgColor
        
        button.target = self
        button.action = #selector(showHideClicked)
        container.addSubview(button)
    }
    
    private func addTimerDisplay(to container: NSView) {
        let timerLabel = NSTextField(frame: NSRect(x: 250, y: 17, width: 50, height: 16))
        timerLabel.stringValue = "00:00"
        timerLabel.isEditable = false
        timerLabel.isBordered = false
        timerLabel.drawsBackground = false
        timerLabel.textColor = NSColor(white: 0.9, alpha: 1.0)
        timerLabel.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
        timerLabel.alignment = .center
        timerLabel.identifier = NSUserInterfaceItemIdentifier("timer")
        
        // Add subtle background for timer
        timerLabel.wantsLayer = true
        timerLabel.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.05).cgColor
        timerLabel.layer?.cornerRadius = 4
        
        container.addSubview(timerLabel)
    }
    
    private func addMicrophoneButton(to container: NSView) {
        let button = NSButton(frame: NSRect(x: 310, y: 13, width: 60, height: 24))
        button.title = "🎤 Coach"
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = NSFont.systemFont(ofSize: 9, weight: .medium)
        button.contentTintColor = NSColor(white: 0.95, alpha: 1.0)
        button.wantsLayer = true
        
        // Modern glass-like button background
        button.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        button.layer?.cornerRadius = 6
        button.layer?.borderWidth = 0.5
        button.layer?.borderColor = NSColor(white: 1.0, alpha: 0.12).cgColor
        
        // Subtle shadow for depth
        button.layer?.shadowOpacity = 0.15
        button.layer?.shadowOffset = CGSize(width: 0, height: 1)
        button.layer?.shadowRadius = 2
        button.layer?.shadowColor = NSColor.black.cgColor
        
        button.target = self
        button.action = #selector(microphoneClicked)
        container.addSubview(button)
    }
    
    private func addMoreOptionsButton(to container: NSView) {
        let button = NSButton(frame: NSRect(x: 380, y: 13, width: 30, height: 24))
        button.title = "⋯"
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        button.contentTintColor = NSColor(white: 0.95, alpha: 1.0)
        button.wantsLayer = true
        
        // Modern glass-like button background
        button.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
        button.layer?.cornerRadius = 6
        button.layer?.borderWidth = 0.5
        button.layer?.borderColor = NSColor(white: 1.0, alpha: 0.12).cgColor
        
        // Subtle shadow for depth
        button.layer?.shadowOpacity = 0.15
        button.layer?.shadowOffset = CGSize(width: 0, height: 1)
        button.layer?.shadowRadius = 2
        button.layer?.shadowColor = NSColor.black.cgColor
        
        button.target = self
        button.action = #selector(moreOptionsClicked)
        container.addSubview(button)
    }
    
    private func applyScreenshotHiding() {
        // THE CORE FEATURE: Hide from screenshots
        window.sharingType = .none
        print("🔒 Screenshot hiding applied (same as original Cluely)")
    }
    
    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.elapsedTime += 1
            self.updateTimerDisplay()
        }
    }
    
    private func updateTimerDisplay() {
        let minutes = elapsedTime / 60
        let seconds = elapsedTime % 60
        let timeString = String(format: "%02d:%02d", minutes, seconds)
        
        if let timerField = window.contentView?.viewWithTag(0)?.subviews.first(where: { 
            $0.identifier?.rawValue == "timer" 
        }) as? NSTextField {
            timerField.stringValue = timeString
        }
    }
    
    private func setupGlobalHotkey() {
        // Monitor for global hotkeys
        globalEventMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { event in
            // Cmd+Shift+\ for show/hide
            if event.modifierFlags.contains([.command, .shift]) && event.keyCode == 42 {
                print("⌨️  Cmd+Shift+\\ detected (global) - toggling interface")
                self.toggleInterface()
            }
            // Cmd+Enter for AI analysis
            else if event.modifierFlags.contains(.command) && event.keyCode == 36 && !event.modifierFlags.contains(.shift) {
                print("🤖 Cmd+Enter detected (global) - triggering AI analysis")
                Task {
                    await self.performManualAIAnalysis()
                }
            }
            // Cmd + Arrow Keys for window movement
            else if event.modifierFlags.contains(.command) && !event.modifierFlags.contains(.shift) {
                _ = self.handleWindowMovement(keyCode: event.keyCode)
            }
        }
        
        // Also monitor local events (when our app has focus)
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.modifierFlags.contains([.command, .shift]) && event.keyCode == 42 {
                print("⌨️  Cmd+Shift+\\ detected (local) - toggling interface")
                self.toggleInterface()
                return nil // Consume the event
            }
            // Cmd+Enter for AI analysis (local)
            else if event.modifierFlags.contains(.command) && event.keyCode == 36 && !event.modifierFlags.contains(.shift) {
                print("🤖 Cmd+Enter detected (local) - triggering AI analysis")
                Task {
                    await self.performManualAIAnalysis()
                }
                return nil // Consume the event
            }
            // Handle window movement locally too
            else if event.modifierFlags.contains(.command) && !event.modifierFlags.contains(.shift) {
                if self.handleWindowMovement(keyCode: event.keyCode) {
                    return nil // Consume the event if we handled it
                }
            }
            return event
        }
        
        print("🎹 Global hotkeys registered:")
        print("   • Cmd+Shift+\\ - Show/Hide interface")
        print("   • Cmd+Enter - Real-time AI streaming analysis")
        print("   • Cmd+Arrow Keys - Move window")
    }
    
    private func handleWindowMovement(keyCode: UInt16) -> Bool {
        let moveDistance: CGFloat = 30 // Pixels to move per key press
        var newOrigin = window.frame.origin
        var didMove = false
        
        switch keyCode {
        case 126: // Up Arrow
            newOrigin.y += moveDistance
            didMove = true
            print("⬆️  Moving window up")
        case 125: // Down Arrow
            newOrigin.y -= moveDistance
            didMove = true
            print("⬇️  Moving window down")
        case 123: // Left Arrow
            newOrigin.x -= moveDistance
            didMove = true
            print("⬅️  Moving window left")
        case 124: // Right Arrow
            newOrigin.x += moveDistance
            didMove = true
            print("➡️  Moving window right")
        default:
            return false // Not an arrow key we handle
        }
        
        if didMove {
            // Ensure window stays within screen bounds
            if let screen = NSScreen.main {
                let screenFrame = screen.visibleFrame
                let windowFrame = window.frame
                
                // Keep window within screen bounds
                newOrigin.x = max(screenFrame.minX, min(newOrigin.x, screenFrame.maxX - windowFrame.width))
                newOrigin.y = max(screenFrame.minY, min(newOrigin.y, screenFrame.maxY - windowFrame.height))
            }
            
            // Animate the movement for smooth repositioning
            window.setFrameOrigin(newOrigin)
        }
        
        return didMove
    }
    
    private func toggleInterface() {
        DispatchQueue.main.async {
            self.isHidden = !self.isHidden
            
            if self.isHidden {
                // Hide using transparency instead of orderOut to keep process alive
                self.window.alphaValue = 0.0
                self.window.ignoresMouseEvents = true
                print("👻 Interface hidden (process stays alive)")
            } else {
                // Show the window and bring to front
                self.window.alphaValue = 1.0
                self.window.ignoresMouseEvents = false
                self.window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
                print("👁  Interface shown")
            }
        }
    }
    
    // MARK: - Button Actions (Cluely functionality)
    
    @objc private func chatClicked() {
        print("💬 Chat clicked - Real-time AI streaming analysis triggered")
        Task {
            await performManualAIAnalysis()
        }
    }
    
    @objc private func startOverClicked() {
        print("↻ Start Over clicked - resetting interview coaching session")
        
        // FIXED: Don't stop listening if it's currently active - just reset state
        let wasListening = isListening
        
        // Cancel any ongoing AI request
        if let task = currentAITask {
            task.cancel()
            currentAITask = nil
            print("🛑 Cancelled ongoing AI request")
        }
        
        // Reset interview coaching state
        interviewMode = false
        conversationHistory.removeAll()
        lastTranscribedText = ""
        lastCoachingAdvice = ""
        isProcessingAI = false
        
        // Hide AI response if visible
        if isResponseVisible {
            hideAIResponse()
        }
        
        // Reset timer
        elapsedTime = 0
        updateTimerDisplay()
        
        // Clear any previous screen text to prevent OCR/audio cross-contamination
        lastScreenText = ""
        print("🧹 Cleared screen OCR text to prevent mixing with audio questions")
        
        // FIXED: If was listening, restart immediately instead of stopping
        if wasListening {
            print("🔄 Restarting interview coaching after reset...")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.startInterviewCoaching()
            }
        }
        
        print("✅ Interview coaching session reset - \(wasListening ? "restarting" : "ready for new interview")")
    }
    
    @objc private func showHideClicked() {
        print("👁 Show/Hide clicked")
        toggleInterface()
    }
    
    @objc private func microphoneClicked() {
        print("🎤 Microphone clicked - toggling interview coaching mode")
        
                if isListening {
            // Stop interview coaching
            stopInterviewCoaching()
                } else {
            // Start interview coaching
            startInterviewCoaching()
        }
    }
    
    @objc private func moreOptionsClicked() {
        print("⋯ More Options clicked - showing menu")
        showMoreOptionsMenu()
    }
    
    private func showMoreOptionsMenu() {
        let menu = NSMenu()
        menu.autoenablesItems = false
        
        // Add quit option
        let quitItem = NSMenuItem(title: "🚪 Quit App", action: #selector(quitAppClicked), keyEquivalent: "")
        quitItem.target = self
        quitItem.isEnabled = true
        menu.addItem(quitItem)
        
        // Add separator
        menu.addItem(NSMenuItem.separator())
        
        // Add other options (placeholder for future features)
        let aboutItem = NSMenuItem(title: "ℹ️ About", action: #selector(aboutClicked), keyEquivalent: "")
        aboutItem.target = self
        aboutItem.isEnabled = true
        menu.addItem(aboutItem)
        
        // Find the more options button to position the menu
        if let containerView = window.contentView {
            for subview in containerView.subviews {
                if let button = subview as? NSButton, button.title == "⋯" {
                    // Show menu at button location
                    let buttonFrame = button.frame
                    let menuLocation = NSPoint(x: buttonFrame.midX, y: buttonFrame.minY)
                    menu.popUp(positioning: nil, at: menuLocation, in: containerView)
                    break
                }
            }
        }
    }
    
    @objc private func quitAppClicked() {
        print("🚪 Quit app clicked - terminating application")
        
        // Clean up before quitting
        timer?.invalidate()
        
        // Clean up global event monitor
        if let monitor = globalEventMonitor {
            NSEvent.removeMonitor(monitor)
        }
        
        // Close any websocket connections
        electronWebSocket?.cancel(with: .goingAway, reason: nil)
        
        // Terminate the application
        NSApp.terminate(nil)
    }
    
    @objc private func aboutClicked() {
        let alert = NSAlert()
        alert.messageText = "About Cluely"
        alert.informativeText = "Cluely Interview Assistant\nVersion 1.0\n\nFeatures:\n• Real-time screen analysis\n• AI-powered responses\n• Interview coaching\n• Screenshot hiding\n\nHotkeys:\n• Cmd+Shift+\\ - Show/Hide\n• Cmd+Enter - AI Analysis\n• Cmd+Arrow Keys - Move window"
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    
    private func showAlert(_ title: String, _ message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Don't terminate when window is closed - stay running in background
        return false
    }
    
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        // Only allow termination on explicit quit (Cmd+Q)
        print("🛑 Application terminating...")
        
        // Clean up timer
        timer?.invalidate()
        
        // Clean up global event monitor
        if let monitor = globalEventMonitor {
            NSEvent.removeMonitor(monitor)
        }
        
        return .terminateNow
    }
    
    @MainActor
    private func performScreenOCR() async {
        guard !isProcessingAI else { return }
        
        do {
            // Capture screen content
            let displays = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = displays.displays.first else {
                print("❌ No display found for OCR")
                return
            }
            
            let filter = SCContentFilter(display: display, excludingWindows: [])
            let configuration = SCStreamConfiguration()
            configuration.width = Int(display.width)
            configuration.height = Int(display.height)
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            
            // Capture single frame
            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
            
            // Perform OCR using Vision framework
            let requestHandler = VNImageRequestHandler(cgImage: image)
            let request = VNRecognizeTextRequest { request, error in
                Task { @MainActor in
                    await self.processOCRResults(request: request, error: error)
                }
            }
            
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            
            try requestHandler.perform([request])
            
        } catch {
            print("❌ OCR Error: \(error.localizedDescription)")
        }
    }
    
    @MainActor
    private func processOCRResults(request: VNRequest, error: Error?) async {
        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            if let error = error {
                print("❌ OCR failed: \(error.localizedDescription)")
            } else {
                print("❌ No text detected on screen")
            }
            return
        }
        
        var detectedText = ""
        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            detectedText += topCandidate.string + " "
        }
        
        let cleanText = detectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // ✅ FIX: Save screen text for combined audio + screen analysis
        lastScreenText = cleanText
        
        if cleanText.count > minTextLength {
            print("📖 Screen text detected: \(cleanText.prefix(100))...")
            // Always analyze text since this is now manual-only
            await analyzeWithGPT4o(screenText: cleanText)
        } else {
            print("❌ Not enough text found on screen (minimum: \(minTextLength) characters)")
        }
    }
    
    private func analyzeWithGPT4o(screenText: String) async {
        guard !isProcessingAI else { return }
        
        // Check if task was cancelled before starting
        guard !Task.isCancelled else { 
            print("🛑 AI analysis cancelled before starting")
            return 
        }
        
        isProcessingAI = true
        defer { 
            isProcessingAI = false
            currentAITask = nil // Clean up task reference
        }
        
        print("🤖 Analyzing with GPT-4o (streaming)...")
        
        // Show response container immediately
        await MainActor.run {
            self.showAIResponseContainer()
        }
        
        let prompt = """
        You are an expert programming and interview assistant. Based on the screen content below, provide comprehensive technical analysis with proper code formatting:
        
        Screen Content:
        \(screenText)
        
        Provide structured analysis in this format:
        
        **Analysis**: [Explain what the code/content is doing in 1-2 sentences]
        
        **Key Concepts**: [Important technical concepts or patterns shown]
        
        **Code Example** (if applicable): 
        ```language
        [Provide clean, properly formatted code that demonstrates the concept or solves the problem]
        ```
        
        **Improvements/Tips**: [Suggestions for optimization, best practices, or interview talking points]
        
        **Interview Focus**: [What an interviewer might ask about this code/topic]
        
        Use proper markdown formatting for code blocks. Keep response comprehensive but under 150 words total.
        """
        
        do {
            // Check cancellation before API call
            try Task.checkCancellation()
            
            let response = try await callOpenAIAPI(prompt: prompt)
            
            // Check cancellation after API call
            try Task.checkCancellation()
            
            print("✅ Streaming completed: \(response.prefix(100))...")
            
            // Response stays visible until manually dismissed via Start Over
        } catch is CancellationError {
            print("🛑 AI analysis was cancelled")
            await MainActor.run {
                self.hideAIResponse()
            }
        } catch {
            print("❌ OpenAI API Error: \(error.localizedDescription)")
            await MainActor.run {
                let errorText = "❌ Error: \(error.localizedDescription)"
                let formattedErrorText = self.formatAIResponseText(errorText)
                self.responseTextView.textStorage?.setAttributedString(formattedErrorText)
                
                // Force NSTextView layout update
                self.responseTextView.layoutManager?.ensureLayout(for: self.responseTextView.textContainer!)
                self.responseTextView.needsDisplay = true
            }
            
            // Error message also stays visible until manually dismissed
        }
    }
    
    private func callOpenAIAPI(prompt: String) async throws -> String {
        guard let url = URL(string: "https://api.openai.com/v1/chat/completions") else {
            throw URLError(.badURL)
        }
        
        let requestBody = [
            "model": openAIModel,
            "messages": [
                [
                    "role": "user",
                    "content": prompt
                ]
            ],
            "max_tokens": maxTokens,
            "temperature": temperature,
            "stream": true // Enable streaming
        ] as [String: Any]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(openAIAPIKey)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (asyncBytes, response) = try await URLSession.shared.bytes(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        var fullResponse = ""
        
        // Process streaming response
        for try await line in asyncBytes.lines {
            // Check if request was cancelled
            if Task.isCancelled {
                throw CancellationError()
            }
            
            if line.hasPrefix("data: ") {
                let jsonString = String(line.dropFirst(6)) // Remove "data: " prefix
                
                if jsonString == "[DONE]" {
                    break
                }
                
                guard let data = jsonString.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let choices = json["choices"] as? [[String: Any]],
                      let delta = choices.first?["delta"] as? [String: Any],
                      let content = delta["content"] as? String else {
                    continue
                }
                
                fullResponse += content
                
                // Update UI in real-time with streaming text
                let currentResponse = fullResponse // Local copy to avoid concurrency issues
                await MainActor.run {
                    print("📝 Updating UI with text: \(currentResponse.suffix(50))...") // Debug log
                    
                    // Apply beautiful formatting to the text
                    let formattedText = self.formatAIResponseText(currentResponse)
                    self.responseTextView.textStorage?.setAttributedString(formattedText)
                    
                    // Force NSTextView layout update
                    self.responseTextView.layoutManager?.ensureLayout(for: self.responseTextView.textContainer!)
                    self.responseTextView.needsDisplay = true // Force redraw
                    
                    // Dynamic resizing: Calculate and apply new height based on content
                    let requiredHeight = self.calculateRequiredHeight(for: currentResponse)
                    self.resizeResponseContainer(to: requiredHeight)
                }
            }
        }
        
        return fullResponse.isEmpty ? "No response generated" : fullResponse
    }
    
    private func showAIResponseContainer() {
        // Ensure window is fully visible
        window.alphaValue = 1.0
        
        // Force container to be visible and on top
        responseContainer.isHidden = false
        
        // Fix #1: Force container to stay on top with explicit positioning
        responseContainer.superview?.addSubview(responseContainer, positioned: .above, relativeTo: nil)
        responseContainer.layer?.zPosition = 999
        
        // REMOVED: Hardcoded "Connecting to GPT-4o" message that was appearing as unwanted preset response
        // Set initial text and calculate required height
        // let initialText = "🔍 Connecting to GPT-4o... Please wait..."
        // let formattedInitialText = formatAIResponseText(initialText)
        // responseTextView.textStorage?.setAttributedString(formattedInitialText)
        // 
        // // Calculate and apply dynamic height
        // let requiredHeight = calculateRequiredHeight(for: initialText)
        // resizeResponseContainer(to: requiredHeight)
        
        // FIXED: Start with empty container, only show content when real AI response comes in
        responseTextView.string = ""
        let minHeight = minResponseHeight
        resizeResponseContainer(to: minHeight)
        
        // Force layout and display updates for ALL relevant views
        responseContainer.needsLayout = true
        responseContainer.needsDisplay = true
        responseContainer.superview?.needsLayout = true
        responseContainer.superview?.needsDisplay = true
        window.contentView?.needsLayout = true
        window.contentView?.needsDisplay = true
        window.displayIfNeeded()
        
        // Force NSTextView layout update
        responseTextView.layoutManager?.ensureLayout(for: responseTextView.textContainer!)
        responseTextView.needsDisplay = true
        
        print("🖼️ Response container shown with minimal height: \(minHeight)")
        print("📏 responseContainer frame: \(responseContainer.frame)")
        print("📏 responseTextView frame: \(responseTextView.frame)")
        print("📏 window frame: \(window.frame)")
        
        isResponseVisible = true
    }
    
    private func hideAIResponse() {
        guard isResponseVisible else { return }
        
        // Animate window back to original size
        let currentFrame = window.frame
        let originalHeight: CGFloat = 50
        let newFrame = NSRect(x: currentFrame.origin.x,
                             y: currentFrame.origin.y + (currentFrame.height - originalHeight), // Move back down
                             width: currentFrame.width,
                             height: originalHeight)
        
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.3
            context.allowsImplicitAnimation = true
            window.animator().setFrame(newFrame, display: true)
        } completionHandler: {
            self.responseContainer.isHidden = true
        }
        
        isResponseVisible = false
        responseTextView.string = ""
    }
    
    @objc private func copyResponseClicked() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(responseTextView.string, forType: .string)
        print("📋 Response copied to clipboard")
        
        // Visual feedback - briefly change copy button text
        if let copyButton = responseContainer.subviews.first(where: { ($0 as? NSButton)?.title.contains("Copy") == true }) as? NSButton {
            let originalTitle = copyButton.title
            copyButton.title = "✅ Copied!"
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                copyButton.title = originalTitle
            }
        }
    }
    
    private func calculateRequiredHeight(for text: String) -> CGFloat {
        // Create a temporary text view with the same settings as the real one
        let tempTextView = NSTextView(frame: NSRect(x: 0, y: 0, width: 428, height: 0)) // FIXED: Match exact width
        
        // Apply the same formatting as the real text view
        let formattedText = formatAIResponseText(text)
        tempTextView.textStorage?.setAttributedString(formattedText)
        
        // Match the real text view settings exactly
        tempTextView.isEditable = false
        tempTextView.isSelectable = true // FIXED: Enable selection for better height calculation
        tempTextView.textContainer?.lineFragmentPadding = 8
        tempTextView.textContainer?.widthTracksTextView = true
        tempTextView.textContainer?.heightTracksTextView = false
        tempTextView.textContainer?.containerSize = NSSize(width: 428, height: CGFloat.greatestFiniteMagnitude)
        
        // Force layout to calculate required size
        tempTextView.layoutManager?.ensureLayout(for: tempTextView.textContainer!)
        let textBounds = tempTextView.layoutManager?.usedRect(for: tempTextView.textContainer!) ?? .zero
        
        // IMPROVED: Better calculation for code blocks and formatted content
        let codeBlockCount = text.components(separatedBy: "```").count - 1
        let lineCount = text.components(separatedBy: .newlines).count
        
        // FIXED: More accurate calculation based on actual content
        let codeBlockExtra: CGFloat = CGFloat(codeBlockCount / 2) * 30 // More space per code block
        let lineExtra: CGFloat = CGFloat(max(0, lineCount - 5)) * 8 // More space for long content
        
        // FIXED: Use actual text bounds with better padding
        let actualTextHeight = textBounds.height
        let textHeight = max(actualTextHeight + codeBlockExtra + lineExtra + 40, 50) // More accurate base padding
        let totalHeight = textHeight + responseTextPadding + 60 // More header/button space
        
        // IMPROVED: Dynamic maximum based on content type
        let hasCodeBlocks = codeBlockCount > 0
        let maxHeight: CGFloat = hasCodeBlocks ? 600 : 400 // Higher max for code
        let finalHeight = max(minResponseHeight, min(maxHeight, totalHeight))
        
        print("📏 ENHANCED Height calculation: actualText=\(actualTextHeight), total=\(textHeight), lines=\(lineCount), codeBlocks=\(codeBlockCount/2), final=\(finalHeight)")
        return finalHeight
    }
    
    private func resizeResponseContainer(to height: CGFloat) {
        let oldFrame = responseContainer.frame
        let newFrame = NSRect(x: oldFrame.origin.x, 
                             y: oldFrame.origin.y, 
                             width: oldFrame.width, 
                             height: height)
        
        // Update container frame
        responseContainer.frame = newFrame
        
        // FIXED: Find and resize the scroll view instead of text view directly
        for subview in responseContainer.subviews {
            if let scrollView = subview as? NSScrollView {
                let scrollViewHeight = height - responseTextPadding - 60 // Match padding in calculation
                let actualScrollViewHeight = max(scrollViewHeight, 40)
                scrollView.frame = NSRect(x: 18, y: 18, width: 428, height: actualScrollViewHeight)
                
                // Update text view within scroll view to allow proper content sizing
                if let textView = scrollView.documentView as? NSTextView {
                    textView.textContainer?.containerSize = NSSize(width: 428, height: CGFloat.greatestFiniteMagnitude)
                    textView.layoutManager?.ensureLayout(for: textView.textContainer!)
                }
                
                print("📏 SCROLL Fixed: scrollView height=\(actualScrollViewHeight)")
                break
            }
        }
        
        // Update header and copy button positions
        for subview in responseContainer.subviews {
            if let label = subview as? NSTextField, label.stringValue.contains("AI Response") {
                label.frame.origin.y = height - 32 // Position header near top
            } else if let button = subview as? NSButton, button.title.contains("Copy") {
                button.frame.origin.y = height - 32 // Position copy button near top
            }
        }
        
        // Resize window to accommodate new response height
        let currentWindowFrame = window.frame
        let mainBarHeight: CGFloat = 50
        let newWindowHeight = mainBarHeight + height + 5 // 5px spacing
        let newWindowFrame = NSRect(x: currentWindowFrame.origin.x,
                                   y: currentWindowFrame.origin.y - (newWindowHeight - currentWindowFrame.height),
                                   width: currentWindowFrame.width,
                                   height: newWindowHeight)
        
        window.setFrame(newWindowFrame, display: true, animate: false)
        
        // FIXED: Force comprehensive layout updates
        responseContainer.needsLayout = true
        responseContainer.needsDisplay = true
        responseTextView.needsLayout = true
        responseTextView.needsDisplay = true
        
        // FIXED: Ensure text view container updates
        responseTextView.textContainer?.containerSize = NSSize(width: 428, height: CGFloat.greatestFiniteMagnitude)
        responseTextView.layoutManager?.ensureLayout(for: responseTextView.textContainer!)
        
        print("📏 ENHANCED Resized: container=\(height), windowHeight=\(newWindowHeight)")
        
        // Debug frame information
        print("📏 responseContainer frame: \(responseContainer.frame)")
        if let scrollView = responseContainer.subviews.first(where: { $0 is NSScrollView }) {
            print("📏 scrollView frame: \(scrollView.frame)")
        }
        print("📏 responseTextView frame: \(responseTextView.frame)")
        print("📏 window frame: \(window.frame)")
    }
    
    private func formatAIResponseText(_ text: String) -> NSAttributedString {
        let attributedString = NSMutableAttributedString(string: text)
        let fullRange = NSRange(location: 0, length: text.count)
        
        // Base text styling
        let baseFont = NSFont.systemFont(ofSize: 14, weight: .regular)
        let textColor = NSColor(white: 0.95, alpha: 1.0)
        
        attributedString.addAttribute(.font, value: baseFont, range: fullRange)
        attributedString.addAttribute(.foregroundColor, value: textColor, range: fullRange)
        
        // IMPROVED: Better line spacing for readability
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 4
        paragraphStyle.paragraphSpacing = 8
        paragraphStyle.lineBreakMode = .byWordWrapping
        attributedString.addAttribute(.paragraphStyle, value: paragraphStyle, range: fullRange)
        
        // FIXED: Format code blocks with monospace font and background
        let codeBlockPattern = "```[^`]*```"
        let codeBlockRegex = try? NSRegularExpression(pattern: codeBlockPattern, options: .dotMatchesLineSeparators)
        let codeBlockMatches = codeBlockRegex?.matches(in: text, options: [], range: fullRange) ?? []
        
        for match in codeBlockMatches {
            let codeFont = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
            let codeColor = NSColor(red: 0.8, green: 1.0, blue: 0.8, alpha: 1.0) // Light green
            let codeBackground = NSColor(white: 0.15, alpha: 1.0)
            
            attributedString.addAttribute(.font, value: codeFont, range: match.range)
            attributedString.addAttribute(.foregroundColor, value: codeColor, range: match.range)
            attributedString.addAttribute(.backgroundColor, value: codeBackground, range: match.range)
        }
        
        // FIXED: Format inline code with backticks
        let inlineCodePattern = "`[^`]+`"
        let inlineCodeRegex = try? NSRegularExpression(pattern: inlineCodePattern, options: [])
        let inlineCodeMatches = inlineCodeRegex?.matches(in: text, options: [], range: fullRange) ?? []
        
        for match in inlineCodeMatches {
            let inlineFont = NSFont.monospacedSystemFont(ofSize: 13, weight: .medium)
            let inlineColor = NSColor(red: 0.6, green: 0.9, blue: 1.0, alpha: 1.0) // Light blue
            let inlineBackground = NSColor(white: 0.1, alpha: 1.0)
            
            attributedString.addAttribute(.font, value: inlineFont, range: match.range)
            attributedString.addAttribute(.foregroundColor, value: inlineColor, range: match.range)
            attributedString.addAttribute(.backgroundColor, value: inlineBackground, range: match.range)
        }
        
        // IMPROVED: Style headers with ** formatting
        let headerPattern = "\\*\\*[^*]+\\*\\*"
        let headerRegex = try? NSRegularExpression(pattern: headerPattern, options: [])
        let headerMatches = headerRegex?.matches(in: text, options: [], range: fullRange) ?? []
        
        for match in headerMatches {
            let headerFont = NSFont.systemFont(ofSize: 15, weight: .semibold)
            let headerColor = NSColor(red: 0.4, green: 0.8, blue: 1.0, alpha: 1.0)
            attributedString.addAttribute(.font, value: headerFont, range: match.range)
            attributedString.addAttribute(.foregroundColor, value: headerColor, range: match.range)
        }
        
        // Style numbered lists and bullet points (existing code)
        let lines = text.components(separatedBy: .newlines)
        var currentLocation = 0
        
        for line in lines {
            let lineRange = NSRange(location: currentLocation, length: line.count)
            
            // Style numbered lists (1., 2., etc.)
            if line.trimmingCharacters(in: .whitespaces).range(of: "^\\d+\\.", options: .regularExpression) != nil {
                let numberFont = NSFont.systemFont(ofSize: 14, weight: .medium)
                let numberColor = NSColor(red: 0.6, green: 0.9, blue: 0.6, alpha: 1.0)
                attributedString.addAttribute(.font, value: numberFont, range: lineRange)
                attributedString.addAttribute(.foregroundColor, value: numberColor, range: lineRange)
            }
            
            currentLocation += line.count + 1 // +1 for newline character
        }
        
        return attributedString
    }
    
    private func performManualAIAnalysis() async {
        guard !openAIAPIKey.isEmpty else {
            print("❌ AI analysis requires OpenAI API key in .env file")
            return
        }
        
        guard !isProcessingAI else {
            print("⏳ AI analysis already in progress...")
            return
        }
        
        print("🔍 Performing manual screen analysis...")
        
        // Create cancellable task for AI analysis
        currentAITask = Task {
            await performScreenOCR()
        }
        
        await currentAITask?.value
    }
    
    private func connectToElectronCompanion() {
        print("🔗 Connecting to Electron Audio Companion on port 8765...")
        
        guard let url = URL(string: "ws://localhost:8765") else {
            print("❌ Invalid WebSocket URL")
            return
        }
        
        urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        electronWebSocket = urlSession?.webSocketTask(with: url)
        electronWebSocket?.resume()
        
        // Start listening for messages
        receiveElectronMessage()
        
        print("🎤 Electron Audio Companion connection initiated")
    }
    
    private func receiveElectronMessage() {
        electronWebSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleElectronMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleElectronMessage(text)
                    }
        @unknown default:
                    break
                }
                // Continue listening
                self?.receiveElectronMessage()
                
            case .failure(let error):
                print("❌ WebSocket receive error: \(error)")
                // Try to reconnect after a delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    self?.connectToElectronCompanion()
                }
            }
        }
    }
    
    private func handleElectronMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            print("📦 Raw message from Electron: \(message)")
            return
        }
        
        DispatchQueue.main.async {
            switch type {
            case "status":
                print("📊 Electron status: \(json)")
                
            case "transcription":
                if let text = json["text"] as? String {
                    self.handleTranscription(text)
                }
                
            case "voiceActivity":
                if let activity = json["activity"] as? String {
                    self.handleRealTimeVoiceActivity(activity, data: json)
                }
                
            case "streamingTranscription":
                if let text = json["text"] as? String {
                    self.handleStreamingTranscription(text, isPartial: json["partial"] as? Bool ?? false)
                }
                
            case "audioCaptureStarted":
                print("🎤 Audio capture started in Electron")
                self.isListening = true
                self.updateMicrophoneButtonState()
                
            case "audioCaptureStopped":
                print("🛑 Audio capture stopped in Electron")
                self.isListening = false
                self.updateMicrophoneButtonState()
                
            case "audioData":
                // Visual feedback for audio activity
                break
                
            default:
                print("❓ Unknown message type from Electron: \(type)")
            }
        }
    }
    
    private func handleRealTimeVoiceActivity(_ activity: String, data: [String: Any]) {
        switch activity {
        case "speechStarted":
            print("🗣️ [REAL-TIME] Speech detected - user is speaking")
            // REMOVED: Automatic status message that was appearing as unwanted preset response
            // if interviewMode && isResponseVisible {
            //     updateResponseText("🗣️ LISTENING... \n\nAI is analyzing your speech in real-time.\nSpeak naturally - you'll get instant feedback!")
            // }
            
        case "speechEnded":
            if let duration = data["duration"] as? Int {
                print("🤐 [REAL-TIME] Speech ended - duration: \(duration)ms")
                // REMOVED: Automatic status message that was appearing as unwanted preset response
                // if interviewMode && isResponseVisible {
                //     updateResponseText("⚡ PROCESSING...\n\nAnalyzing your response and preparing AI feedback...")
                // }
            }
            
        default:
            break
        }
    }
    
    private func handleStreamingTranscription(_ text: String, isPartial: Bool) {
        print("🌊 [STREAMING] \(isPartial ? "Partial" : "Final") transcription: \(text)")
        
        // REMOVED: Automatic streaming status messages that were appearing as unwanted preset responses
        // if interviewMode && isResponseVisible {
        //     let prefix = isPartial ? "🌊 STREAMING: " : "✅ HEARD: "
        //     let status = isPartial ? "Getting real-time AI analysis..." : "Preparing complete response..."
        //     
        //     updateResponseText("\(prefix)\"\(text)\"\n\n\(status)")
        //     
        //     // If this is a partial transcription and long enough, start getting AI feedback
        //     if isPartial && text.count >= 10 {
        //         Task {
        //             await self.analyzePartialTranscription(text)
        //         }
        //     }
        // }
    }
    
    private func analyzePartialTranscription(_ text: String) async {
        // Quick AI analysis for streaming feedback
        guard !isProcessingAI else { return }
        
        print("⚡ [STREAMING] Getting instant AI feedback for: \(text)")
        
        let quickPrompt = """
        User is speaking: "\(text)"
        
        Provide instant interview feedback in 1-2 sentences:
        - Quick tip for their response
        - What to add or improve
        
        Keep it under 40 words for real-time delivery.
        """
        
        do {
            let quickResponse = try await callOpenAIAPI(prompt: quickPrompt)
            
            await MainActor.run {
                let currentText = self.responseTextView.string
                let enhancedText = currentText + "\n\n💡 INSTANT TIP: \(quickResponse)"
                self.updateResponseText(enhancedText)
            }
            
            print("✅ [STREAMING] Instant feedback delivered")
        } catch {
            print("❌ [STREAMING] Quick feedback error: \(error)")
        }
    }
    
    private func sendToElectron(_ message: [String: Any]) {
        guard let electronWebSocket = electronWebSocket else {
            print("❌ No WebSocket connection to Electron")
            return
        }
        
        do {
            let data = try JSONSerialization.data(withJSONObject: message)
            let message = URLSessionWebSocketTask.Message.data(data)
            
            electronWebSocket.send(message) { error in
                if let error = error {
                    print("❌ Error sending to Electron: \(error)")
                }
            }
        } catch {
            print("❌ Error serializing message: \(error)")
        }
    }
    
    private func handleTranscription(_ text: String) {
        print("📝 Transcription received: \(text)")
        
        // Filter out empty, very short, or meaningless transcriptions
        let cleanedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check if transcription is meaningful enough for analysis
        guard !cleanedText.isEmpty,
              cleanedText.count >= 10, // Minimum 10 characters
              !isCommonNoisePhrase(cleanedText),
              isInterviewRelevant(cleanedText) else {
            print("🚫 Skipping analysis - transcription not interview-relevant: '\(cleanedText)'")
            return
        }
        
        lastTranscribedText = cleanedText
        
        // Add to conversation history
        conversationHistory.append(cleanedText)
        
        // Keep only last 10 exchanges
        if conversationHistory.count > 10 {
            conversationHistory = Array(conversationHistory.suffix(10))
        }

        // FIXED: Only analyze transcription if interview mode is active AND user wants coaching
        if interviewMode && isListening {
            print("🎓 [INTERVIEW MODE] Analyzing transcription for coaching...")
            Task {
                await analyzeTranscriptionWithGPT4o(transcription: cleanedText)
            }
        } else {
            print("🔇 [PASSIVE] Transcription logged but no coaching (interview mode: \(interviewMode), listening: \(isListening))")
        }
    }
    
    // Helper function to filter out common noise phrases
    private func isCommonNoisePhrase(_ text: String) -> Bool {
        let lowercased = text.lowercased()
        let commonNoises = [
            "uh", "um", "ah", "er", "hmm", "mhm", "yeah", "ok", "okay", 
            "...", "huh", "what", "test", "testing", "hello", "hi",
            "can you hear me", "is this working", "microphone test",
            "thanks for watching", "thank you for watching", "bye", "goodbye",
            "peace", "see you later", "until next time", "that's all",
            "subscribe", "like and subscribe", "follow me", "check out",
            "visit", "website", "channel", "video", "tutorial"
        ]
        
        // Check commercial/advertising content that shouldn't trigger coaching
        let commercialPhrases = [
            "beadaholique", "for all of your", "supply needs", "visit our website",
            "check out our", "available at", "shop now", "buy now", "order today",
            "special offer", "discount", "sale", "promotion", "deal"
        ]
        
        // Check if the entire transcription is just a common noise phrase
        for noise in commonNoises {
            if lowercased == noise || lowercased.replacingOccurrences(of: " ", with: "") == noise.replacingOccurrences(of: " ", with: "") {
                return true
            }
        }
        
        // Check for commercial/advertising content
        for phrase in commercialPhrases {
            if lowercased.contains(phrase) {
                print("🚫 Blocking commercial content: '\(text)'")
                return true
            }
        }
        
        // Block very short responses
        if text.trimmingCharacters(in: .whitespacesAndNewlines).count < 15 {
            return true
        }
        
        // Block repetitive content (same word repeated)
        let words = lowercased.components(separatedBy: .whitespaces)
        let uniqueWords = Set(words)
        if words.count > 2 && uniqueWords.count < words.count / 2 {
            print("🚫 Blocking repetitive content: '\(text)'")
            return true
        }
        
        return false
    }
    
    // NEW: Real-time transcription analysis (same as screen analysis)
    private func analyzeTranscriptionWithGPT4o(transcription: String) async {
        guard !isProcessingAI else { return }
        
        // Double-check transcription is meaningful before expensive AI analysis
        let cleanedTranscription = transcription.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanedTranscription.count >= 10, !isCommonNoisePhrase(cleanedTranscription) else {
            print("🚫 Skipping AI analysis - transcription still too short after filtering: '\(cleanedTranscription)'")
            return
        }
        
        // Check if task was cancelled before starting
        guard !Task.isCancelled else { 
            print("🛑 Transcription AI analysis cancelled before starting")
            return 
        }
        
        isProcessingAI = true
        defer { 
            isProcessingAI = false
            currentAITask = nil
        }
        
        print("🤖 Analyzing transcription with GPT-4o (real-time streaming)...")
        
        // Show response container immediately (like screen analysis)
        await MainActor.run {
            self.showAIResponseContainer()
        }
        
        // FIXED: Interview-focused prompt with proper code formatting
        var prompt = """
        You are an expert interview coach. The candidate just said: "\(cleanedTranscription)"
        
        Provide specific interview coaching advice with proper code formatting:
        
        **Quick Response**: [Suggest a strong 1-2 sentence response]
        
        **Key Points**: [What specific points to mention]
        
        **Code Example** (if applicable): 
        ```language
        [Provide clean, properly formatted code]
        ```
        
        **Delivery Tips**: [How to sound confident and professional]
        
        Keep response under 100 words total. Use proper markdown formatting for code blocks.
        """
        
        // REMOVED: Automatic screen context inclusion that was causing OCR text to repeat
        // Audio transcription should be analyzed independently from screen OCR
        // Only the user's spoken words should be considered for coaching advice
        
        do {
            // Check cancellation before API call
            try Task.checkCancellation()
            
            let response = try await callOpenAIAPI(prompt: prompt)
            
            // Check cancellation after API call
            try Task.checkCancellation()
            
            print("✅ Real-time interview coaching completed: \(response.prefix(100))...")
            
        } catch is CancellationError {
            print("🛑 Transcription AI analysis was cancelled")
            await MainActor.run {
                self.hideAIResponse()
            }
        } catch {
            print("❌ Transcription OpenAI API Error: \(error.localizedDescription)")
            await MainActor.run {
                let errorText = "❌ Error analyzing transcription: \(error.localizedDescription)"
                let formattedErrorText = self.formatAIResponseText(errorText)
                self.responseTextView.textStorage?.setAttributedString(formattedErrorText)
                
                // Force NSTextView layout update
                self.responseTextView.layoutManager?.ensureLayout(for: self.responseTextView.textContainer!)
                self.responseTextView.needsDisplay = true
            }
        }
    }
    
    private func updateResponseText(_ text: String) {
        let formattedText = formatAIResponseText(text)
        responseTextView.textStorage?.setAttributedString(formattedText)
        
        // Calculate and apply dynamic height
        let requiredHeight = calculateRequiredHeight(for: text)
        resizeResponseContainer(to: requiredHeight)
        
        // Force layout updates
        responseTextView.layoutManager?.ensureLayout(for: responseTextView.textContainer!)
        responseTextView.needsDisplay = true
    }
    
    private func startInterviewCoaching() {
        print("🎓 Starting interview coaching mode...")
                    
        // Check if Electron companion is connected
        guard electronWebSocket != nil else {
            print("❌ Electron Audio Companion not connected")
            showAlert("Connection Error", "Please make sure the Electron Audio Companion is running:\ncd electron-audio-companion && npm start")
            return
        }
        
        // Clear screen text to prevent OCR contamination in audio analysis
        lastScreenText = ""
        print("🧹 Cleared screen OCR text for clean audio analysis")
        
        // Enable interview mode
        interviewMode = true
        
        // Send start command to Electron
        sendToElectron([
            "type": "startAudioCapture"
        ])
        
        print("✅ Real-time voice analysis activated")
    }
    
    private func stopInterviewCoaching() {
        print("🛑 Stopping interview coaching mode...")
        
        // Disable interview mode
        interviewMode = false
        
        // Send stop command to Electron
        sendToElectron([
            "type": "stopAudioCapture"
        ])
        
        print("✅ Interview coaching mode deactivated")
    }
    
    private func updateMicrophoneButtonState() {
        // Find microphone button and update its appearance
        if let containerView = window.contentView {
            for subview in containerView.subviews {
                if let button = subview as? NSButton, button.title.contains("🎤") || button.title.contains("🔴") {
                    if isListening {
                        button.title = "🔴 LIVE" // More descriptive when listening
                        button.layer?.backgroundColor = NSColor(red: 0.9, green: 0.2, blue: 0.2, alpha: 0.4).cgColor
                        
                        // Add pulsing animation for active listening
                        let pulseAnimation = CABasicAnimation(keyPath: "opacity")
                        pulseAnimation.duration = 1.0
                        pulseAnimation.fromValue = 0.4
                        pulseAnimation.toValue = 0.8
                        pulseAnimation.autoreverses = true
                        pulseAnimation.repeatCount = Float.infinity
                        button.layer?.add(pulseAnimation, forKey: "pulse")
                        
                        // Add subtle glow effect
                        button.layer?.shadowOpacity = 0.4
                        button.layer?.shadowColor = NSColor.red.cgColor
                        button.layer?.shadowRadius = 8
                        
                    } else {
                        button.title = "🎤 Coach" // Microphone when not listening
                        button.layer?.backgroundColor = NSColor(white: 1.0, alpha: 0.08).cgColor
                        
                        // Remove animations and effects
                        button.layer?.removeAnimation(forKey: "pulse")
                        button.layer?.shadowOpacity = 0.15
                        button.layer?.shadowColor = NSColor.black.cgColor
                        button.layer?.shadowRadius = 2
                    }
                }
            }
        }
    }
    
    // Helper function to check if transcription is interview-relevant
    private func isInterviewRelevant(_ text: String) -> Bool {
        let lowercased = text.lowercased()
        
        // Interview-related keywords
        let interviewKeywords = [
            "experience", "project", "challenge", "team", "work", "role", "skill",
            "algorithm", "code", "programming", "software", "technical", "system",
            "problem", "solution", "design", "implement", "develop", "build",
            "java", "python", "swift", "javascript", "react", "node", "database",
            "api", "backend", "frontend", "framework", "library", "architecture",
            "performance", "optimization", "testing", "debugging", "deployment",
            "agile", "scrum", "git", "version", "control", "review", "collaboration",
            "leadership", "management", "responsibility", "achievement", "goal",
            "learn", "improve", "grow", "mentor", "teach", "communicate",
            "tell me about", "describe", "explain", "how would you", "what is",
            "why did you", "can you walk me through", "give me an example"
        ]
        
        // Check for interview-related content
        for keyword in interviewKeywords {
            if lowercased.contains(keyword) {
                return true
            }
        }
        
        // Check if it's a question (often interview questions)
        if lowercased.contains("?") || 
           lowercased.hasPrefix("what") || lowercased.hasPrefix("how") || 
           lowercased.hasPrefix("why") || lowercased.hasPrefix("tell me") ||
           lowercased.hasPrefix("describe") || lowercased.hasPrefix("explain") {
            return true
        }
        
        // If none of the above, it's probably not interview-relevant
        print("🚫 Not interview-relevant: '\(text)'")
        return false
    }
}

// MARK: - URLSessionWebSocketDelegate

extension CluelyUIDelegate {
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        print("✅ Connected to Electron Audio Companion")
        
        // Send ping to confirm connection
        sendToElectron([
            "type": "ping"
        ])
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("🔌 Disconnected from Electron Audio Companion")
                
        // Try to reconnect after a delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            self.connectToElectronCompanion()
        }
    }
}

// MARK: - Main Application Entry Point

print(String(repeating: "=", count: 60))
print("🎯 CLUELY UI REPLICA - POLISHED & TRANSPARENT")
print(String(repeating: "=", count: 60))
print("📱 Creating polished floating interface...")
print("🎨 More transparent design matching real Cluely")
print("🔒 Including screenshot hiding functionality")
print("")

let app = NSApplication.shared
let delegate = CluelyUIDelegate()
app.delegate = delegate

print("🚀 Starting polished Cluely interface...")
app.run()

print("👋 Cluely UI Replica terminated") 