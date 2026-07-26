import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', specialization: '', email: '', phone: '', availableDays: [], availableHours: { start: '09:00', end: '17:00' } });

  const fetchData = () => {
    setLoading(true);
    api.get('/doctors')
      .then(res => setDoctors(res.data))
      .catch(() => toast.error('Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const toggleDay = (day) => {
    const days = form.availableDays.includes(day)
      ? form.availableDays.filter(d => d !== day)
      : [...form.availableDays, day];
    setForm({ ...form, availableDays: days });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/doctors', form);
      toast.success('Doctor created');
      setShowForm(false);
      setForm({ name: '', specialization: '', email: '', phone: '', availableDays: [], availableHours: { start: '09:00', end: '17:00' } });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this doctor?')) return;
    try {
      await api.delete(`/doctors/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Doctors</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : '+ Add Doctor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Doctor name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" required />
            <input placeholder="Specialization" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})} className="px-4 py-2 border rounded-lg outline-none" />
            <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="px-4 py-2 border rounded-lg outline-none" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="px-4 py-2 border rounded-lg outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Available Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${form.availableDays.includes(day) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'}`}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Time</label>
              <input type="time" value={form.availableHours.start} onChange={e => setForm({...form, availableHours: {...form.availableHours, start: e.target.value}})} className="px-4 py-2 border rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Time</label>
              <input type="time" value={form.availableHours.end} onChange={e => setForm({...form, availableHours: {...form.availableHours, end: e.target.value}})} className="px-4 py-2 border rounded-lg outline-none" />
            </div>
          </div>
          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-primary-700">Save</button>
        </form>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map(d => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Dr. {d.name}</h3>
                  <p className="text-sm text-primary-600">{d.specialization}</p>
                </div>
                <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <div className="mt-3 text-sm text-gray-500 space-y-1">
                {d.email && <p>{d.email}</p>}
                {d.phone && <p>{d.phone}</p>}
                <p className="mt-2">Days: {(d.availableDays || []).map(day => day.slice(0, 3)).join(', ')}</p>
                <p>Hours: {d.availableHours?.start || '09:00'} - {d.availableHours?.end || '17:00'}</p>
              </div>
              <div className="mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {d.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
