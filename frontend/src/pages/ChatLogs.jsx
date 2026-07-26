import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function ChatLogs() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    api.get('/knowledge')
      .then(() => {
        return api.get('/admin/dashboard');
      })
      .then(() => {
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Chat Logs</h1>

      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500 mb-4">Chat logs are stored per session in the database.</p>
        <p className="text-sm text-gray-400">
          Each chatbot conversation is tracked with visitor ID, messages, and detected intents.
          <br />Sessions are accessible via the chat API and are linked to appointment bookings.
        </p>
        <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left max-w-lg mx-auto">
          <h3 className="font-medium text-gray-700 mb-2">API Endpoints:</h3>
          <code className="text-xs text-gray-600 block mb-1">POST /api/chat/send - Send message</code>
          <code className="text-xs text-gray-600 block mb-1">POST /api/chat/close - End session</code>
          <code className="text-xs text-gray-600 block">GET /api/appointments/stats - View stats</code>
        </div>
      </div>
    </div>
  );
}
