import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Services() {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', durationMinutes: 30, price: '', doctorId: '' });

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.get('/services'), api.get('/doctors')])
      .then(([s, d]) => { setServices(s.data); setDoctors(d.data); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/services', { ...form, price: form.price ? parseFloat(form.price) : null, doctorId: parseInt(form.doctorId) });
      toast.success('Service created');
      setShowForm(false);
      setForm({ name: '', description: '', durationMinutes: 30, price: '', doctorId: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service?')) return;
    try {
      await api.delete(`/services/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Services</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : '+ Add Service'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Service name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" required />
            <select value={form.doctorId} onChange={e => setForm({...form, doctorId: e.target.value})} className="px-4 py-2 border rounded-lg outline-none" required>
              <option value="">Select Doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
            </select>
            <input type="number" placeholder="Duration (min)" value={form.durationMinutes} onChange={e => setForm({...form, durationMinutes: parseInt(e.target.value)})} className="px-4 py-2 border rounded-lg outline-none" />
            <input type="number" placeholder="Price ($)" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="px-4 py-2 border rounded-lg outline-none" />
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" rows={2} />
          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-primary-700">Save</button>
        </form>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{s.description}</td>
                  <td className="px-4 py-3">{s.durationMinutes} min</td>
                  <td className="px-4 py-3">${s.price || 'N/A'}</td>
                  <td className="px-4 py-3">Dr. {s.doctor?.name}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
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
