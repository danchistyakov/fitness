import { useState, type ReactElement } from 'react';
import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import ClientProfile from '@/pages/ClientProfile';
import Exercises from '@/pages/Exercises';
import Programs from '@/pages/Programs';
import ProgramEditor from '@/pages/ProgramEditor';
import Sessions from '@/pages/Sessions';
import SessionDetail from '@/pages/SessionDetail';
import ChurnAnalytics from '@/pages/ChurnAnalytics';
import Segments from '@/pages/Segments';
import ProgramsAnalytics from '@/pages/ProgramsAnalytics';
import Recommendations from '@/pages/Recommendations';
import AccessControl from '@/pages/AccessControl';
import TrainersAccounts from '@/pages/TrainersAccounts';

import Sidebar from '@/components/Sidebar';
import MobileHeader from '@/components/MobileHeader';
import ToastContainer from '@/components/Toast';

import { authStore } from '@/stores';
import { ROLE_PAGES } from '@/utils/roles';

interface ProtectedProps {
  element: ReactElement;
  pageId: string;
  ownershipCheck?: () => boolean;
}

const ProtectedRoute = observer(({ element, pageId, ownershipCheck }: ProtectedProps) => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  const role = authStore.role;
  if (!role) return <Navigate to="/login" replace />;

  if (ownershipCheck) {
    if (!ownershipCheck()) return <Navigate to="/" replace />;
  } else {
    const allowed = ROLE_PAGES[role] ?? [];
    if (!allowed.includes(pageId)) return <Navigate to="/" replace />;
  }
  return element;
});

const ClientOwnedRoute = observer(({ element }: { element: ReactElement }) => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  return element;
});

const AppLayout = observer(() => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
      <main className="main-content">
        <Routes>
          <Route path="/"                    element={<ProtectedRoute element={<Dashboard />}          pageId="dashboard" />} />
          <Route path="/clients"             element={<ProtectedRoute element={<Clients />}            pageId="clients" />} />
          <Route path="/clients/:id"         element={<ClientOwnedRoute element={<ClientProfile />} />} />
          <Route path="/exercises"           element={<ProtectedRoute element={<Exercises />}          pageId="exercises" />} />
          <Route path="/programs"            element={<ProtectedRoute element={<Programs />}           pageId="programs" />} />
          <Route path="/programs/:id"        element={<ProtectedRoute element={<ProgramEditor />}      pageId="programs" />} />
          <Route path="/sessions"            element={<ProtectedRoute element={<Sessions />}           pageId="sessions" />} />
          <Route path="/sessions/:id"        element={<ClientOwnedRoute element={<SessionDetail />} />} />
          <Route path="/churn"               element={<ProtectedRoute element={<ChurnAnalytics />}     pageId="churn" />} />
          <Route path="/segments"            element={<ProtectedRoute element={<Segments />}           pageId="segments" />} />
          <Route path="/programs-analytics"  element={<ProtectedRoute element={<ProgramsAnalytics />}  pageId="programs-analytics" />} />
          <Route path="/recommendations"     element={<ProtectedRoute element={<Recommendations />}    pageId="recommendations" />} />
          <Route path="/access"              element={<ProtectedRoute element={<AccessControl />}      pageId="access" />} />
          <Route path="/trainers-accounts"   element={<ProtectedRoute element={<TrainersAccounts />} pageId="trainers-accounts" />} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
});

const App = observer(() => {
  if (!authStore.isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*"      element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }
  return <AppLayout />;
});

export default App;
