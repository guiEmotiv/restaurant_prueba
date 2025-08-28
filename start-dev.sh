#!/bin/bash
# Ultra-Simple Development Starter
# Usage: ./start-dev.sh

echo "🚀 Starting Restaurant Web Development Environment..."
echo "📱 Opening both backend and frontend in separate terminals..."

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Make scripts executable
chmod +x scripts/local/start-backend.sh
chmod +x scripts/local/start-frontend.sh

# Try different terminal emulators based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🔧 Starting Backend (Django)..."
    osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && ./scripts/local/start-backend.sh"'
    
    sleep 2
    
    echo "🎨 Starting Frontend (React)..."
    osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && ./scripts/local/start-frontend.sh"'
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "cd $(pwd) && ./scripts/local/start-backend.sh; exec bash"
        gnome-terminal -- bash -c "cd $(pwd) && ./scripts/local/start-frontend.sh; exec bash"
    elif command -v konsole >/dev/null 2>&1; then
        konsole -e bash -c "cd $(pwd) && ./scripts/local/start-backend.sh; exec bash" &
        konsole -e bash -c "cd $(pwd) && ./scripts/local/start-frontend.sh; exec bash" &
    elif command -v xterm >/dev/null 2>&1; then
        xterm -e bash -c "cd $(pwd) && ./scripts/local/start-backend.sh; exec bash" &
        xterm -e bash -c "cd $(pwd) && ./scripts/local/start-frontend.sh; exec bash" &
    else
        echo "⚠️  No suitable terminal found. Please run manually:"
        echo "   Terminal 1: ./scripts/local/start-backend.sh"
        echo "   Terminal 2: ./scripts/local/start-frontend.sh"
        exit 1
    fi
else
    # Windows/Other
    echo "⚠️  Auto-start not supported on this OS. Please run manually:"
    echo "   Terminal 1: ./scripts/local/start-backend.sh"
    echo "   Terminal 2: ./scripts/local/start-frontend.sh"
    exit 1
fi

echo ""
echo "✅ Development environment starting..."
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/api/v1/docs/"
echo ""
echo "💡 To stop: Close the terminal windows or press Ctrl+C in each"