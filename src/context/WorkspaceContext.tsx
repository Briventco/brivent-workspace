import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, InAppNotification, Announcement } from '../types';
import { workspaceService } from '../services/workspaceService';

interface WorkspaceContextType {
  currentUser: User;
  switchUser: (userId: string) => void;
  hasPermission: (action: string) => boolean;
  notifications: InAppNotification[];
  unreadNotifCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  announcements: Announcement[];
  acknowledgeAnnouncement: (id: string) => void;
  refreshData: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => workspaceService.getCurrentUser());
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => workspaceService.getNotifications());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => workspaceService.getAnnouncements());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const refreshData = () => {
    setCurrentUser(workspaceService.getCurrentUser());
    setNotifications(workspaceService.getNotifications());
    setAnnouncements(workspaceService.getAnnouncements());
  };

  const switchUser = (userId: string) => {
    const user = workspaceService.setCurrentUser(userId);
    setCurrentUser(user);
    setNotifications(workspaceService.getNotifications());
    showToast(`Switched active view to: ${user.name} (${user.roleTitle})`);
  };

  const hasPermission = (action: string) => {
    return workspaceService.hasPermission(action);
  };

  const markNotificationAsRead = (id: string) => {
    workspaceService.markNotificationAsRead(id);
    setNotifications(workspaceService.getNotifications());
  };

  const markAllNotificationsAsRead = () => {
    workspaceService.markAllNotificationsAsRead();
    setNotifications(workspaceService.getNotifications());
    showToast('All notifications marked as read.');
  };

  const acknowledgeAnnouncement = (id: string) => {
    workspaceService.acknowledgeAnnouncement(id);
    setAnnouncements(workspaceService.getAnnouncements());
    showToast('Announcement acknowledged.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        currentUser,
        switchUser,
        hasPermission,
        notifications,
        unreadNotifCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        announcements,
        acknowledgeAnnouncement,
        refreshData,
        toastMessage,
        showToast,
        activeTab,
        setActiveTab,
        searchQuery,
        setSearchQuery,
        isSearchOpen,
        setIsSearchOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

