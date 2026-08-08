import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';
import api from '../api/axios';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAppointments = () => {
    setLoading(true);
    const params = filter ? { status: filter } : {};
    api.get('/appointments', { params })
      .then(res => setAppointments(res.data))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAppointments(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success(`Appointment ${status}`);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
        <select
          value={filter} onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="booked">Booked</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : appointments.length === 0 ? (
        <p className="text-gray-500">No appointments found.</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appt => (
                <tr key={appt.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{appt.patientName}</div>
                    <div className="text-xs text-gray-500">{appt.patientPhone || appt.patientEmail}</div>
                  </td>
                  <td className="px-4 py-3">Dr. {appt.doctor?.name}</td>
                  <td className="px-4 py-3">{appt.service?.name}</td>
                  <td className="px-4 py-3">{new Date(appt.appointmentDate).toLocaleDateString([], { timeZone: 'UTC' })}</td>
                  <td className="px-4 py-3">{new Date(appt.appointmentTime).toLocaleTimeString([], { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3"><StatusBadge status={appt.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {appt.status === 'booked' && (
                        <button onClick={() => updateStatus(appt.id, 'confirmed')} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Confirm</button>
                      )}
                      {appt.status === 'confirmed' && (
                        <button onClick={() => updateStatus(appt.id, 'completed')} className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Complete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
