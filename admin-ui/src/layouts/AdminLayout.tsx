import { Outlet, NavLink } from 'react-router'
import { LayoutDashboard, FileText, Users, Bot, Server, Menu, Bell, Mail, MessageSquare, LineChart, Database, Activity, AlertTriangle, Map, LifeBuoy, Target } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsMobile(true)
        setSidebarOpen(false)
      } else {
        setIsMobile(false)
        setSidebarOpen(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Tin đăng & Duyệt', path: '/listings', icon: FileText },
    { name: 'Khách hàng & User', path: '/users', icon: Users },
    { name: 'Quản lý Scraping', path: '/scraping', icon: Activity },
    { name: 'AI Agents', path: '/ai-agents', icon: Bot },
    { name: 'Yêu cầu Hỗ trợ', path: '/help-requests', icon: LifeBuoy },
    { name: 'Chiến dịch bản đồ', path: '/campaigns', icon: Target },
    { name: 'Báo cáo vi phạm', path: '/reports', icon: AlertTriangle },
    { name: 'Quản lý Email', path: '/emails', icon: Mail },
    { name: 'Marketing', path: '/marketing', icon: Mail },
    { name: 'Chat & Comments', path: '/interactions', icon: MessageSquare },
    { name: 'Từ khóa & Analytics', path: '/analytics', icon: LineChart },
    { name: 'Danh mục Từ điển', path: '/master-data', icon: Database },
    { name: 'Lớp Bản đồ', path: '/map-layers', icon: Map },
    { name: 'Database Explorer', path: '/database', icon: Server },
    { name: 'Server & Hệ thống', path: '/server', icon: Activity },
  ]

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans relative">
      {/* Mobile Backdrop */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-50
        ${isMobile ? 'fixed h-full shadow-2xl' : 'relative h-full'}
        ${sidebarOpen ? 'w-64' : isMobile ? '-translate-x-full w-64' : 'w-20'}`}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-200 shrink-0">
          <span className="font-extrabold text-xl text-indigo-700 tracking-tight">
            {(sidebarOpen || isMobile) ? 'Admin.City' : 'AC'}
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 [scrollbar-width:thin]">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={20} className="shrink-0" />
                {(sidebarOpen || isMobile) && <span className="whitespace-nowrap">{item.name}</span>}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-md hover:bg-slate-100 text-slate-600">
              <Menu size={20} />
            </button>
            <h1 className="font-semibold text-lg text-slate-800 hidden sm:block">Bảng điều khiển</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-slate-100 text-slate-600 relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
