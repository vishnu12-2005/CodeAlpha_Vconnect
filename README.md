# V Connect — Where We Connect, Collaborate, and Create

V Connect is a full-stack real-time collaboration and video communication platform built with the Clean Purple design system.

## Key Features

- **Multi-user Video Calling**: mesh WebRTC calling with Socket.io signaling.
- **Screen Sharing**: Live capture using standard browser APIs, substituting the local video stream with the screen share track.
- **Noise Suppression**: Web Audio API integration filtering out microphone hum below 150Hz and utilizing dynamics compression as a noise gate.
- **Collaborative Whiteboard**: Collaborative drawing canvas that syncs brush size, colors, lines, circles, and shapes instantly across clients.
- **In-Call Chat & File Sharing**: Sync text messages and upload files up to 25MB via a secure multipart Express API.
- **Files Vault**: Easily accessible repository triggered from the sidebar that indexes all files uploaded across meetings.
- **Auth & Scheduler**: JWT signup/login, Mock Google OAuth flow, and an interactive meeting scheduler with copyable room links.

---

## Tech Stack

- **Frontend**: React (Vite), React Router, Zustand State, Sockets Client.
- **Backend**: Node.js, Express, Socket.io, Multer, bcryptjs, jsonwebtoken.
- **Database**: Local file-based JSON database (zero external installations needed).
- **Styling**: Vanilla CSS utilizing CSS variables for HSL colors and flexible layout modules.

---

## Quick Start

### 1. Installation

Install dependencies for both the frontend and backend:

**Backend Server:**
```bash
cd syncspace/server
npm install
```

**Frontend Client:**
```bash
cd syncspace/client
npm install
```

### 2. Running Locally

Start the backend server:
```bash
cd syncspace/server
npm run dev
```

Start the frontend client:
```bash
cd syncspace/client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.
