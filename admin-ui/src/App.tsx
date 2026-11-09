import { Routes, Route, Navigate } from 'react-router'
import { useAuth } from './lib/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import Dashboard from './pages/Dashboard'
import Listings from './pages/Listings'
import Users from './pages/Users'
import ServerMonitor from './pages/ServerMonitor'
import Login from './pages/Login'

import DatabaseExplorer from './pages/DatabaseExplorer'
import ScrapingJobs from './pages/ScrapingJobs'
import AiAgents from './pages/AiAgents'
import MapLayers from './pages/MapLayers'
import MasterData from './pages/MasterData'
import HelpRequests from './pages/HelpRequests'
import Campaigns from './pages/Campaigns'

import Interactions from './pages/Interactions'
import Marketing from './pages/Marketing'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Emails from './pages/Emails'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AuthGuard><AdminLayout /></AuthGuard>}>
        <Route index element={<Dashboard />} />
        <Route path="listings" element={<Listings />} />
        <Route path="users" element={<Users />} />
        <Route path="scraping" element={<ScrapingJobs />} />
        <Route path="ai-agents" element={<AiAgents />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="interactions" element={<Interactions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="map-layers" element={<MapLayers />} />
        <Route path="master-data" element={<MasterData />} />
        <Route path="help-requests" element={<HelpRequests />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="database" element={<DatabaseExplorer />} />
        <Route path="server" element={<ServerMonitor />} />
        <Route path="emails" element={<Emails />} />
      </Route>
    </Routes>
  )
}

export default App
