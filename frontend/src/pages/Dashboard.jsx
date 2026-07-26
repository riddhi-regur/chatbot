import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaUserMd, FaStethoscope, FaBook, FaComments, FaCalendarCheck } from 'react-icons/fa';
import StatsCard from '../components/StatsCard';
import api from '../api/axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard icon={FaCalendarAlt} label="Total Appointments" value={stats?.totalAppointments || 0} color="primary" />
        <StatsCard icon={FaCalendarCheck} label="Today's Appointments" value={stats?.todayAppointments || 0} color="blue" />
        <StatsCard icon={FaUserMd} label="Active Doctors" value={stats?.totalDoctors || 0} color="green" />
        <StatsCard icon={FaStethoscope} label="Services" value={stats?.totalServices || 0} color="purple" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Knowledge Base</h3>
          <p className="text-3xl font-bold text-primary-600">{stats?.totalKB || 0}</p>
          <p className="text-sm text-gray-500 mt-1">articles indexed</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Chat Sessions</h3>
          <p className="text-3xl font-bold text-primary-600">{stats?.chatSessions || 0}</p>
          <p className="text-sm text-gray-500 mt-1">total conversations</p>
        </div>
      </div>
      <div className="mt-6 bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 mb-2">System Status</h3>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${stats?.ollamaStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm text-gray-600">Ollama LLM: {stats?.ollamaStatus ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </div>
  );
}
