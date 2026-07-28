import { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function ChatLogs() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchSessions = (p = page, q = search) => {
    setLoading(true);
    const params = { page: p, limit: 15 };
    if (q.trim()) params.visitorId = q.trim();
    api.get('/admin/chat-sessions', { params })
      .then(res => {
        setSessions(res.data.sessions);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => toast.error('Failed to load chat sessions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(1, search); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSessions(1, search);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchSessions(newPage, search);
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chat Logs</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total sessions</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search by visitor ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none w-56"
          />
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600">
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500">No chat sessions found.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Visitor ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ended</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Messages</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Intents</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <Fragment key={session.id}>
                    <tr
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(session.id)}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {expandedId === session.id ? '▼' : '▶'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {session.visitorId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatTime(session.startedAt)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {session.endedAt ? formatTime(session.endedAt) : <span className="text-green-600">Active</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {session.messageCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {session.intents.map((intent, i) => (
                            <span key={i} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                              {intent}
                            </span>
                          ))}
                          {session.intents.length === 0 && (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === session.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          <div className="max-h-80 overflow-y-auto space-y-2">
                            {session.messages.map((msg, i) => (
                              <div
                                key={msg.id || i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-lg px-4 py-2 rounded-lg text-sm ${
                                    msg.role === 'user'
                                      ? 'bg-primary-500 text-white rounded-br-none'
                                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                                  }`}
                                >
                                  <div className="whitespace-pre-wrap">{msg.content}</div>
                                  <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {msg.intent && <span className="ml-2 opacity-70">[{msg.intent}]</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
