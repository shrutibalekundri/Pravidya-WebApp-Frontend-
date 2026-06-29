import { useState, useEffect } from 'react';
import { questionAPI } from '../services/api';
import toast from 'react-hot-toast';

const QuestionResponseForm = ({ sessionId, leadId, onResponseSubmitted }) => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [context, setContext] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedQuestion || !answer.trim()) {
      toast.error('Please select a question and provide an answer');
      return;
    }

    setSubmitting(true);
    try {
      await questionAPI.submitResponse(selectedQuestion, {
        answer,
        sessionId: sessionId || null,
        leadId: leadId || null,
        context: Object.keys(context).length > 0 ? context : null
      });
      toast.success('Response submitted successfully');
      setAnswer('');
      setSelectedQuestion('');
      setContext({});
      if (onResponseSubmitted) {
        onResponseSubmitted();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading questions...</div>;
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Question Response</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Question *
          </label>
          <select
            value={selectedQuestion}
            onChange={(e) => setSelectedQuestion(e.target.value)}
            className="input-field"
            required
          >
            <option value="">Choose a question...</option>
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.text}
              </option>
            ))}
          </select>
          {selectedQuestion && (
            <p className="text-sm text-gray-600 mt-1">
              {questions.find(q => q.id === selectedQuestion)?.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Response *
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="input-field"
            rows="4"
            required
            placeholder="Enter your response here..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionResponseForm;
