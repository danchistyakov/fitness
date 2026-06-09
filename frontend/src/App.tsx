import { useState, type ReactElement } from 'react';
import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';

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
import GymLoad from '@/pages/GymLoad';
import Recommendations from '@/pages/Recommendations';
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

const HomeRedirect = observer(() => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  const role = authStore.role;
  if (role === 'client') return <Navigate to="/programs" replace />;
  if (role === 'trainer') return <Navigate to="/clients" replace />;
  return <ProtectedRoute element={<Dashboard />} pageId="dashboard" />;
});

const ClientOwnedRoute = observer(({ element }: { element: ReactElement }) => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  const { id } = useParams<{ id: string }>();
  const numericId = id ? parseInt(id, 10) : NaN;

  // Клиент может видеть только свой профиль
  if (authStore.role === 'client' && authStore.user?.client_id !== numericId) {
    return <Navigate to="/" replace />;
  }
  // Для тренера и админа — разрешаем, backend проверит права
  return element;
});

const SessionOwnedRoute = observer(({ element }: { element: ReactElement }) => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  // Клиент: разрешаем, сама страница загрузит сессию и получит 403 если чужая
  // Тренер: разрешаем, backend проверит
  // Админ: разрешаем
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
          <Route path="/"                    element={<HomeRedirect />} />
          <Route path="/clients"             element={<ProtectedRoute element={<Clients />}            pageId="clients" />} />
          <Route path="/clients/:id"         element={<ClientOwnedRoute element={<ClientProfile />} />} />
          <Route path="/exercises"           element={<ProtectedRoute element={<Exercises />}          pageId="exercises" />} />
          <Route path="/programs"            element={<ProtectedRoute element={<Programs />}           pageId="programs" />} />
          <Route path="/programs/:id"        element={<ProtectedRoute element={<ProgramEditor />}      pageId="programs" />} />
          <Route path="/sessions"            element={<ProtectedRoute element={<Sessions />}           pageId="sessions" />} />
          <Route path="/sessions/:id"        element={<SessionOwnedRoute element={<SessionDetail />} />} />
          <Route path="/churn"               element={<ProtectedRoute element={<ChurnAnalytics />}     pageId="churn" />} />
          <Route path="/segments"            element={<ProtectedRoute element={<Segments />}           pageId="segments" />} />
          <Route path="/programs-analytics"  element={<ProtectedRoute element={<ProgramsAnalytics />}  pageId="programs-analytics" />} />
          <Route path="/gym-load"              element={<ProtectedRoute element={<GymLoad />}            pageId="gym-load" />} />
          <Route path="/recommendations"     element={<ProtectedRoute element={<Recommendations />}    pageId="recommendations" />} />
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
