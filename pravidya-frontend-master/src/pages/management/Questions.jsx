import { useState, useEffect } from 'react';
import { questionAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Questions = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [formData, setFormData] = useState({
    text: '',
    description: '',
    category: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await questionAPI.getAll({ isActive: 'true' });
      setQuestions(response.data.data.questions || []);
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNew = () => {
    setSelectedQuestion(null);
    setFormData({ text: '', description: '', category: '' });
    setShowModal(true);
  };

  const handleView = async (question) => {
    try {
      const response = await questionAPI.getById(question.id);
      setSelectedQuestion(response.data.data);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load question details');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (selectedQuestion) {
        await questionAPI.update(selectedQuestion.id, formData);
        toast.success('Question updated successfully');
      } else {
        await questionAPI.create(formData);
        toast.success('Question created successfully');
      }
      setShowModal(false);
      fetchQuestions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddScore = async (responseId, points, category, notes) => {
    try {
      await questionAPI.addScore(responseId, { points, category, notes });
      toast.success('Score added successfully');
      if (selectedQuestion) {
        const response = await questionAPI.getById(selectedQuestion.id);
        setSelectedQuestion(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to add score');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Question-Response System</h1>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGEMENT') && (
          <button onClick={handleAddNew} className="btn-primary">
            + Create Question
          </button>
        )}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Question</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Responses</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center p-6 text-slate-500">
                    No questions found.
                  </td>
                </tr>
              ) : (
                questions.map((question) => (
                  <tr key={question.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{question.text}</p>
                        {question.description && (
                          <p className="text-sm text-slate-500">{question.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{question.category || 'General'}</td>
                    <td className="p-3">{question._count?.responses || 0}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleView(question)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/View Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedQuestion ? 'Question Details' : 'Create Question'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>

            {selectedQuestion ? (
              // View Mode
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{selectedQuestion.text}</h3>
                  {selectedQuestion.description && (
                    <p className="text-slate-700">{selectedQuestion.description}</p>
                  )}
                  {selectedQuestion.category && (
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                      {selectedQuestion.category}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Responses ({selectedQuestion.responses?.length || 0})</h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {selectedQuestion.responses?.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No responses yet</p>
                    ) : (
                      selectedQuestion.responses.map((response) => {
                        const totalScore = response.scores?.reduce((sum, score) => sum + score.points, 0) || 0;
                        return (
                          <div key={response.id} className="border p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">{response.counselor?.fullName || response.counselor?.user?.username}</p>
                                <p className="text-sm text-slate-600">
                                  {new Date(response.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-600">Total Score</p>
                                <p className="text-lg font-bold text-blue-600">{totalScore}</p>
                              </div>
                            </div>
                            <p className="text-slate-700 mb-3">{response.answer}</p>
                            {response.scores && response.scores.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-medium text-slate-700 mb-2">Scores:</p>
                                <div className="space-y-1">
                                  {response.scores.map((score) => (
                                    <div key={score.id} className="flex justify-between text-sm">
                                      <span>{score.category || 'General'}: {score.points} points</span>
                                      {score.notes && <span className="text-slate-500">{score.notes}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(user?.role === 'ADMIN' || user?.role === 'MANAGEMENT') && (
                              <div className="mt-3 pt-3 border-t">
                                <button
                                  onClick={() => {
                                    const points = prompt('Enter points:');
                                    const category = prompt('Enter category (optional):') || null;
                                    const notes = prompt('Enter notes (optional):') || null;
                                    if (points) {
                                      handleAddScore(response.id, parseInt(points), category, notes);
                                    }
                                  }}
                                  className="btn-secondary text-sm"
                                >
                                  Add Score
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Create Mode
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Text *</label>
                  <textarea
                    name="text"
                    value={formData.text}
                    onChange={handleInputChange}
                    className="input-field"
                    rows="3"
                    required
                    placeholder="e.g., What kind of user are you more aligned with?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="input-field"
                    rows="2"
                    placeholder="Additional context or instructions"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="e.g., Alignment, Quality, Engagement"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                  >
                    {submitting ? 'Saving...' : 'Create Question'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Questions;
