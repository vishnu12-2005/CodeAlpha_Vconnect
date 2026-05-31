import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Scheduler from './pages/Scheduler';
import Room from './pages/Room';
import Chat from './pages/Chat';
import { useAppStore } from './store/useAppStore';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/scheduler" element={<ProtectedRoute><Scheduler /></ProtectedRoute>} />
        <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/chat/:partnerId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
