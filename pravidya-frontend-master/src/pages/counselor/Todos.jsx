import { useState, useEffect, useMemo } from 'react';
import { todoAPI, counselorAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, isToday, isTomorrow, startOfDay, isAfter } from 'date-fns';

const CounselorTodos = () => {
  const { user } = useAuth();
  const counselorId = user?.counselorProfile?.id || user?.counselorProfile?._id;

  const [todos, setTodos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null); // todo object when editing, null otherwise
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: '',
    leadId: '',
  });
  const [titleError, setTitleError] = useState('');
  const [period, setPeriod] = useState('all'); // 'all' | 'today' | 'tomorrow' | 'upcoming'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    if (counselorId) {
      counselorAPI
        .getLeads(counselorId)
        .then((res) => setLeads(res.data?.data?.leads ?? []))
        .catch(() => setLeads([]));
    }
  }, [counselorId]);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const response = await todoAPI.getAll();
      setTodos(response.data?.data?.todos ?? []);
    } catch (error) {
      toast.error('Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  const filteredTodos = useMemo(() => {
    let list = [...todos];
    const now = startOfDay(new Date());

    if (period === 'today') {
      list = list.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
    } else if (period === 'tomorrow') {
      list = list.filter((t) => t.dueDate && isTomorrow(new Date(t.dueDate)));
    } else if (period === 'upcoming') {
      list = list.filter((t) => t.dueDate && isAfter(startOfDay(new Date(t.dueDate)), now) && !isTomorrow(new Date(t.dueDate)));
    } else if (period === 'all') {
      // no date filter
    }

    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.lead && (
            (t.lead.studentName && t.lead.studentName.toLowerCase().includes(q)) ||
            (t.lead.parentName && t.lead.parentName.toLowerCase().includes(q)) ||
            (t.lead.institution?.name && t.lead.institution.name.toLowerCase().includes(q))
          ))
      );
    }

    return list.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [todos, period, statusFilter, search]);

  const counts = useMemo(() => {
    const now = startOfDay(new Date());
    const today = todos.filter((t) => t.dueDate && isToday(new Date(t.dueDate)));
    const tomorrow = todos.filter((t) => t.dueDate && isTomorrow(new Date(t.dueDate)));
    const upcoming = todos.filter(
      (t) => t.dueDate && isAfter(startOfDay(new Date(t.dueDate)), now) && !isTomorrow(new Date(t.dueDate))
    );
    return {
      today: today.length,
      tomorrow: tomorrow.length,
      upcoming: upcoming.length,
      pending: todos.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length,
      completed: todos.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [todos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTitleError('');
    if (!formData.title?.trim()) {
      setTitleError('Title is required');
      toast.error('Please enter a title');
      return;
    }
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority || 'MEDIUM',
        dueDate: formData.dueDate || undefined,
        leadId: formData.leadId?.trim() || undefined,
      };
      await todoAPI.create(payload);
      toast.success('Todo created successfully');
      setShowModal(false);
      setFormData({ title: '', description: '', priority: 'MEDIUM', dueDate: '', leadId: '' });
      setTitleError('');
      fetchTodos();
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to create todo';
      toast.error(message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await todoAPI.update(id, { status: newStatus });
      toast.success('Todo updated');
      fetchTodos();
    } catch (error) {
      toast.error('Failed to update todo');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this todo?')) {
      try {
        await todoAPI.delete(id);
        toast.success('Todo deleted');
        fetchTodos();
      } catch (error) {
        toast.error('Failed to delete todo');
      }
    }
  };

  const openEditModal = (todo) => {
    setEditingTodo(todo);
    setFormData({
      title: todo.title || '',
      description: todo.description || '',
      priority: todo.priority || 'MEDIUM',
      dueDate: todo.dueDate ? format(new Date(todo.dueDate), 'yyyy-MM-dd') : '',
      leadId: todo.leadId || todo.lead?.id || '',
    });
    setTitleError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setTitleError('');
    if (!editingTodo) return;
    if (!formData.title?.trim()) {
      setTitleError('Title is required');
      toast.error('Please enter a title');
      return;
    }
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority || 'MEDIUM',
        dueDate: formData.dueDate || undefined,
        leadId: formData.leadId?.trim() || null,
      };
      const res = await todoAPI.update(editingTodo.id, payload);
      const updated = res.data?.data?.todo;
      if (updated) {
        setTodos((prev) => prev.map((t) => (t.id === editingTodo.id ? updated : t)));
      } else {
        fetchTodos();
      }
      toast.success('Todo updated');
      setEditingTodo(null);
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to update todo';
      toast.error(message);
    }
  };

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDueBadge = (dueDate) => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    if (isToday(d)) return { label: 'Due Today', className: 'bg-red-100 text-red-800' };
    if (isTomorrow(d)) return { label: 'Tomorrow', className: 'bg-blue-100 text-blue-800' };
    return { label: format(d, 'MMM dd, yyyy'), className: 'bg-gray-100 text-gray-700' };
  };

  const getInitial = (title) => {
    if (!title || !title.trim()) return '?';
    return title.trim().charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">To-Dos</h1>
        <p className="text-gray-600 mt-0.5">Manage your tasks</p>
      </div>

      {/* Date filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'today', label: 'Today', count: counts.today },
          { key: 'tomorrow', label: 'Tomorrow', count: counts.tomorrow },
          { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { key: 'all', label: 'All', count: null },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="ml-1.5 opacity-90">({count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search tasks or lead name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="btn-primary whitespace-nowrap"
        >
          Add New Todo
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Status:</span>
        {['PENDING', 'IN_PROGRESS', 'COMPLETED', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFilter === s
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Todo cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filteredTodos.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            No todos match your filters. Try changing date or status, or add a new todo.
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const dueBadge = getDueBadge(todo.dueDate);
            // Use lead from API, or fallback to leads list (in case API doesn't return relation)
            const leadSource = todo.lead || (todo.leadId && leads.find((l) => l.id === todo.leadId));
            const leadDisplayName = leadSource
              ? `${leadSource.studentName}${leadSource.institution?.name ? ` · ${leadSource.institution.name}` : ''}`
              : null;
            const avatarInitial = leadSource ? getInitial(leadSource.studentName) : getInitial(todo.title);
            return (
              <div
                key={todo.id}
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
                      {avatarInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {dueBadge && (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${dueBadge.className}`}>
                            {dueBadge.label}
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getPriorityStyles(todo.priority)}`}>
                          {todo.priority}
                        </span>
                      </div>
                      <p className="text-sm mb-1">
                        <span className="font-medium text-gray-500">Lead: </span>
                        <span className={leadDisplayName ? 'font-medium text-gray-900' : 'text-gray-400'}>
                          {leadDisplayName || '—'}
                        </span>
                      </p>
                      <h3 className={`text-lg font-semibold text-gray-900 ${todo.status === 'COMPLETED' ? 'line-through text-gray-500' : ''}`}>
                        {todo.title}
                      </h3>
                      {todo.description && (
                        <p className="mt-1 text-sm text-gray-600">{todo.description}</p>
                      )}
                      {todo.dueDate && (
                        <p className="mt-1 text-sm text-gray-500">
                          Due: {format(new Date(todo.dueDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(todo)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    {todo.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(todo.id, 'COMPLETED')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(todo.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="flex flex-wrap gap-6 py-4 border-t border-gray-200 text-sm text-gray-600">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Pending: {counts.pending}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Completed: {counts.completed}
        </span>
        <span className="inline-flex items-center gap-2">
          Total: {todos.length}
        </span>
      </div>

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEditingTodo(null)} aria-hidden="true" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit Todo</h2>
                <button
                  type="button"
                  onClick={() => setEditingTodo(null)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Related Lead</label>
                  <select
                    value={formData.leadId}
                    onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">No lead (personal task)</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.studentName} · {lead.institution?.name || '—'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Select a lead to show their name on this todo.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value });
                      if (titleError) setTitleError('');
                    }}
                    className={`input-field w-full ${titleError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    placeholder="e.g. Call back parent"
                  />
                  {titleError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{titleError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field w-full"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTodo(null)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Todo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add New Todo Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} aria-hidden="true" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Add New Todo</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Related Lead</label>
                  <select
                    value={formData.leadId}
                    onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">No lead (personal task)</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.studentName} · {lead.institution?.name || '—'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Select a lead to show their name on the todo card.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value });
                      if (titleError) setTitleError('');
                    }}
                    className={`input-field w-full ${titleError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    placeholder="e.g. Call back parent, Send brochure"
                  />
                  {titleError && (
                    <p className="mt-1 text-sm text-red-600" role="alert">{titleError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field w-full"
                    rows="3"
                    placeholder="Optional notes..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="input-field w-full"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Add Todo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CounselorTodos;
