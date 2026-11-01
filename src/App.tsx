import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { RoleSwitcherBanner } from './components/layout/RoleSwitcherBanner';
import { TopNavbar } from './components/layout/TopNavbar';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { TaskCreateModal } from './components/tasks/TaskCreateModal';
import { TaskDetailDrawer } from './components/tasks/TaskDetailDrawer';

// Views
import { DashboardView } from './views/DashboardView';
import { TasksView } from './views/TasksView';
import { ProjectsView } from './views/ProjectsView';
import { MessagesView } from './views/MessagesView';
import { DocumentsView } from './views/DocumentsView';
import { DirectoryView } from './views/DirectoryView';
import { DailyRoutineView } from './views/DailyRoutineView';
import { CalendarView } from './views/CalendarView';
import { AdminView } from './views/AdminView';
import { SettingsView } from './views/SettingsView';
import { SignInView } from './views/SignInView';
import { InviteAcceptanceView } from './views/InviteAcceptanceView';

import { workspaceService } from './services/workspaceService';
import { Task } from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, toastMessage } = useWorkspace();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Authentication simulator view
  const [authView, setAuthView] = useState<'app' | 'signin' | 'invite'>('app');

  const handleOpenTask = (taskId: string) => {
    const task = workspaceService.getTaskById(taskId);
    if (task) {
      setSelectedTask(task);
    }
  };

  const handleOpenCheckIn = () => {
    setActiveTab('daily');
  };

  if (authView === 'signin') {
    return (
      <SignInView
        onSignedIn={() => setAuthView('app')}
        onGoToInvite={() => setAuthView('invite')}
      />
    );
  }

  if (authView === 'invite') {
    return (
      <InviteAcceptanceView
        onAccountActivated={() => setAuthView('app')}
        onGoToSignIn={() => setAuthView('signin')}
      />
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onOpenTask={handleOpenTask}
            onOpenCheckIn={handleOpenCheckIn}
          />
        );
      case 'tasks':
        return <TasksView />;
      case 'projects':
        return <ProjectsView />;
      case 'messages':
        return <MessagesView />;
      case 'docs':
        return <DocumentsView />;
      case 'directory':
        return <DirectoryView />;
      case 'daily':
        return <DailyRoutineView />;
      case 'calendar':
        return <CalendarView />;
      case 'admin':
        return <AdminView />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <DashboardView
            onOpenTask={handleOpenTask}
            onOpenCheckIn={handleOpenCheckIn}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Role Switcher Demo Bar at the very top */}
      <RoleSwitcherBanner />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
          <TopNavbar
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenNewTaskModal={() => setIsNewTaskOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {renderActiveView()}
          </main>
        </div>
      </div>

      {/* Global Modals & Drawers */}
      <GlobalSearchModal />

      <TaskCreateModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onTaskCreated={() => {}}
      />

      <TaskDetailDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => {
          if (selectedTask) {
            setSelectedTask(workspaceService.getTaskById(selectedTask.id) || null);
          }
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <WorkspaceProvider>
      <MainLayout />
    </WorkspaceProvider>
  );
}

