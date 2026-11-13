import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { OfficerAuthProvider, useOfficerAuth } from './context/OfficerAuthContext';
import { CitizenChatbotPage } from './pages/citizen/CitizenChatbotPage';
import { OfficerLoginPage } from './pages/officer/OfficerLoginPage';
import { OfficerDashboardPage } from './pages/officer/OfficerDashboardPage';
import { OfficerApplicationsPage } from './pages/officer/OfficerApplicationsPage';
import { OfficerApplicationDetailPage } from './pages/officer/OfficerApplicationDetailPage';
import { OfficerReportsPage } from './pages/officer/OfficerReportsPage';

// Protected Officer Route wrapper
const ProtectedOfficerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useOfficerAuth();
  if (!isAuthenticated) {
    return <Navigate to="/officer/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <OfficerAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 1. Citizen Mobile-First Chatbot PWA Interface */}
            <Route path="/" element={<CitizenChatbotPage />} />

            {/* 2. Officer Management Desktop Portal */}
            <Route path="/officer/login" element={<OfficerLoginPage />} />
            
            <Route
              path="/officer"
              element={<Navigate to="/officer/dashboard" replace />}
            />
            
            <Route
              path="/officer/dashboard"
              element={
                <ProtectedOfficerRoute>
                  <OfficerDashboardPage />
                </ProtectedOfficerRoute>
              }
            />

            <Route
              path="/officer/applications"
              element={
                <ProtectedOfficerRoute>
                  <OfficerApplicationsPage />
                </ProtectedOfficerRoute>
              }
            />

            <Route
              path="/officer/applications/:id"
              element={
                <ProtectedOfficerRoute>
                  <OfficerApplicationDetailPage />
                </ProtectedOfficerRoute>
              }
            />

            <Route
              path="/officer/reports"
              element={
                <ProtectedOfficerRoute>
                  <OfficerReportsPage />
                </ProtectedOfficerRoute>
              }
            />

            {/* Catch-all fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OfficerAuthProvider>
    </LanguageProvider>
  );
};

export default App;
