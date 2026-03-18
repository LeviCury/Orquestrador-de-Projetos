import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import MyWork from '@/pages/MyWork';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Collaborators from '@/pages/Collaborators';
import CollaboratorDetail from '@/pages/CollaboratorDetail';
import TimeEntries from '@/pages/TimeEntries';
import Templates from '@/pages/Templates';
import Workload from '@/pages/Workload';

import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import { Loader2 } from 'lucide-react';

function ProtectedRoutes() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={32} className="text-[#4a7fa5] animate-spin" />
      </div>
    );
  }

  if (!authenticated) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/collaborators" element={<Collaborators />} />
        <Route path="/collaborators/:id" element={<CollaboratorDetail />} />
        <Route path="/time-entries" element={<TimeEntries />} />
        <Route path="/workload" element={<Workload />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
