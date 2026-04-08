# Blinq : Presence time calculator using python and open cv - React UI

Modern, futuristic React frontend for the Blinq : Presence time calculator using python and open cv presence detection system.

## Features

- ⏱️ **Real-time Stopwatch** - AI-powered presence detection with live updates
- 👥 **User Management** - Enroll users via webcam or photo upload
- 📋 **Session Logging** - Track study sessions with detailed timestamps
- 🎨 **Modern UI** - Glassmorphic design with neon accents and smooth animations
- 📱 **Responsive** - Works great on desktop and mobile devices

## Tech Stack

- **React 19** - Modern UI framework
- **Vite 6** - Fast build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **TypeScript** - Type-safe development
- **Lucide React** - Beautiful icons

## Setup

### Prerequisites
- Node.js 18+ and npm
- Flask backend running on `http://localhost:5000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Architecture

### Components

- **App.tsx** - Main app component with state management and API polling
- **StopwatchDisplay** - Large time display with status indicator
- **Controls** - Restart and reconnect buttons
- **SessionLog** - View and manage session history
- **UserManagement** - View enrolled users and select person
- **EnrollmentForm** - Enroll new users via webcam or photo

### API Integration

Connects to Flask backend endpoints:
- `GET /status/<sensor_id>` - Get current presence status
- `GET /authorized-users` - Get enrolled users
- `GET /selected-user` - Get selected person
- `POST /select-user` - Set selected person
- `POST /enroll` - Enroll via webcam
- `POST /enroll-photo` - Enroll via photo upload
- `DELETE /remove-user` - Remove user
- `GET /session-log` - Get session history
- `DELETE /session-log` - Clear session log

## Theme

Modern dark theme with:
- Primary: Cyan (#a1faff)
- Secondary: Lime Green (#c3f400)
- Tertiary: Purple (#ac89ff)
- Error: Red (#ff716c)
- Background: Dark navy (#0c0e12)

## Customization

### Colors

Edit `tailwind.config.ts` to change theme colors:

```ts
colors: {
  primary: '#a1faff',      // Cyan
  secondary: '#c3f400',    // Lime
  tertiary: '#ac89ff',     // Purple
  // ...
}
```

### Fonts

Uses Google Fonts:
- **Space Grotesk** - Headlines and labels
- **Manrope** - Body text

Configure in `src/index.css`

## Notes

- Ensure Flask backend is running before starting the React app
- CORS must be enabled on Flask backend (already configured in `app.py`)
- WebSocket support possible for real-time updates (future enhancement)

## License

MIT
