import { NavLink } from 'react-router-dom';
import { FaCalendarAlt, FaStethoscope, FaUserMd, FaBook, FaComments, FaTachometerAlt } from 'react-icons/fa';

const links = [
  { to: '/', label: 'Dashboard', icon: FaTachometerAlt },
  { to: '/appointments', label: 'Appointments', icon: FaCalendarAlt },
  { to: '/services', label: 'Services', icon: FaStethoscope },
  { to: '/doctors', label: 'Doctors', icon: FaUserMd },
  { to: '/knowledge', label: 'Knowledge Base', icon: FaBook },
  { to: '/chat-logs', label: 'Chat Logs', icon: FaComments },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-primary-800 text-white flex flex-col">
      <div className="p-5 border-b border-primary-700">
        <h1 className="text-xl font-bold">ClinicBot</h1>
        <p className="text-primary-300 text-xs mt-1">Admin Panel</p>
      </div>
      <nav className="flex-1 p-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-200 hover:bg-primary-700 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
