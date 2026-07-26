import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const CATEGORIES = ['general', 'service', 'treatment', 'faq', 'policy'];

export default function KnowledgeBase() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });
  const [filter, setFilter] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = filter ? { category: filter } : {};
    api.get('/knowledge', { params })
      .then(res => setItems(res.data))
      .catch(() => toast.error('Failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/knowledge/${editId}`, form);
        toast.success('Updated');
      } else {
        await api.post('/knowledge', form);
        toast.success('Created');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ title: '', content: '', category: 'general' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleEdit = (item) => {
    setForm({ title: item.title || '', content: item.content, category: item.category || 'general' });
    setEditId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this knowledge entry?')) return;
    try {
      await api.delete(`/knowledge/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Knowledge Base</h1>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: '', content: '', category: 'general' }); }}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700">
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="px-4 py-2 border rounded-lg outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <textarea placeholder="Content (knowledge base text for RAG)" value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" rows={4} required />
          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-primary-700">
            {editId ? 'Update' : 'Save'}
          </button>
        </form>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : items.length === 0 ? (
        <p className="text-gray-500">No entries found.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{item.title || 'Untitled'}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.content}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handleEdit(item)} className="text-primary-500 hover:text-primary-700 text-xs">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
