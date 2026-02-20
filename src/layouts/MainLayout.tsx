import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { MobileHeader } from '@/components/MobileHeader';
import { useGlobalRealtimeSync } from '@/hooks/useRealtimeSubscription';
import { AIAssistant } from '@/components/AIAssistant';

export function MainLayout() {
  // Enable global realtime sync for all data tables
  useGlobalRealtimeSync();

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden relative">
      <Sidebar />
      <MobileNav />
      <div className="flex-1 flex flex-col h-screen md:ml-56 ml-16 overflow-hidden">
        <MobileHeader />
        <main className="flex-1 p-2 md:p-4 w-full overflow-y-auto overflow-x-hidden" style={{ fontSize: '75%' }}>
          <div className="max-w-7xl mx-auto pb-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
