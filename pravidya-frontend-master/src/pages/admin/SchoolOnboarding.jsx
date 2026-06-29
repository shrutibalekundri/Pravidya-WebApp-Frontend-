import { useState, useEffect } from 'react';
import { schoolAPI, adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const SchoolOnboarding = () => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [schoolFields, setSchoolFields] = useState({ customFields: [], requiredFields: {} });

  const isSchoolFieldVisible = (key) => schoolFields[key] !== false;
  const isSchoolFieldRequired = (key) =>
    ['name'].includes(key) || schoolFields.requiredFields?.[key] === true;
  const [formData, setFormData] = useState({
    name: '',
    board: 'CBSE',
    city: '',
    state: '',
    academicYear: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    capacity: '',
    pockets: [{ name: '', description: '' }]
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSettings = () => {
    adminAPI.getSettings().then((res) => {
      const d = res.data?.data?.schoolFields;
      if (d) {
        const rf = d && typeof d.requiredFields === 'object' ? d.requiredFields : {};
        setSchoolFields((prev) => ({
          ...prev,
          ...d,
          customFields: d.customFields || prev.customFields,
          requiredFields: { ...(prev.requiredFields || {}), ...rf },
        }));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchSettings(); };
    const onSettingsUpdated = () => fetchSettings();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('settings-updated', onSettingsUpdated);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('settings-updated', onSettingsUpdated);
    };
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const response = await schoolAPI.getAll();
      setSchools(response.data.data.schools || []);
    } catch (error) {
      console.error('Failed to load schools:', error);
      if (error.response?.status === 404) {
        toast.error('Backend server not responding. Please ensure the backend is running on port 8000.');
      } else {
        toast.error('Failed to load schools');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePocketChange = (index, field, value) => {
    const newPockets = [...formData.pockets];
    newPockets[index][field] = value;
    setFormData(prev => ({ ...prev, pockets: newPockets }));
  };

  const addPocket = () => {
    setFormData(prev => ({
      ...prev,
      pockets: [...prev.pockets, { name: '', description: '' }]
    }));
  };

  const removePocket = (index) => {
    setFormData(prev => ({
      ...prev,
      pockets: prev.pockets.filter((_, i) => i !== index)
    }));
  };

  const handleAddNew = () => {
    setEditingSchool(null);
    setCurrentStep(1);
    setFormData({
      name: '',
      board: 'CBSE',
      city: '',
      state: '',
      academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      contactEmail: '',
      contactPhone: '',
      address: '',
      capacity: '',
      pockets: [{ name: '', description: '' }]
    });
    setShowModal(true);
  };

  const handleEdit = (school) => {
    setEditingSchool(school);
    setCurrentStep(1);
    setFormData({
      name: school.name,
      board: school.board,
      city: school.city,
      state: school.state,
      academicYear: school.academicYear,
      contactEmail: school.contactEmail || '',
      contactPhone: school.contactPhone || '',
      address: school.address || '',
      capacity: school.capacity?.toString() || '',
      pockets: school.pockets?.length > 0 
        ? school.pockets.map(p => ({ name: p.name, description: p.description || '' }))
        : [{ name: '', description: '' }]
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // In step 3, only allow submission when explicitly clicking the submit button
    // Prevent auto-submission from Enter key presses
    if (currentStep === 3) {
      const submitter = e.nativeEvent?.submitter;
      // If no submitter (Enter key) or submitter is not the submit button, prevent submission
      if (!submitter || submitter.type !== 'submit' || !submitter.classList.contains('btn-primary')) {
        return;
      }
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      return;
    }

    // Validate required fields based on schoolFields settings
    if (isSchoolFieldVisible('name') && isSchoolFieldRequired('name') && !formData.name?.trim()) {
      toast.error('School name is required'); return;
    }
    if (isSchoolFieldVisible('boards') && isSchoolFieldRequired('boards') && !formData.board?.trim()) {
      toast.error('Board is required'); return;
    }
    if (isSchoolFieldVisible('city') && isSchoolFieldRequired('city') && !formData.city?.trim()) {
      toast.error('City is required'); return;
    }
    if (isSchoolFieldVisible('state') && isSchoolFieldRequired('state') && !formData.state?.trim()) {
      toast.error('State is required'); return;
    }
    if (isSchoolFieldVisible('address') && isSchoolFieldRequired('address') && !formData.address?.trim()) {
      toast.error('Address is required'); return;
    }
    if (!formData.academicYear?.trim()) {
      toast.error('Academic year is required'); return;
    }

    setSubmitting(true);
    try {
      // Clean up the data before submission
      const submitData = {
        name: formData.name.trim(),
        board: formData.board,
        city: formData.city.trim(),
        state: formData.state.trim(),
        academicYear: formData.academicYear.trim(),
        contactEmail: formData.contactEmail?.trim() || null,
        contactPhone: formData.contactPhone?.trim() || null,
        address: formData.address?.trim() || null,
        capacity: formData.capacity && formData.capacity.trim() !== '' 
          ? parseInt(formData.capacity) 
          : null,
        pockets: formData.pockets
          .filter(p => p.name.trim() !== '')
          .map(p => ({
            name: p.name.trim(),
            description: p.description?.trim() || null
          }))
      };

      if (editingSchool) {
        await schoolAPI.update(editingSchool.id, submitData);
        toast.success('School updated successfully');
      } else {
        await schoolAPI.create(submitData);
        toast.success('School onboarded successfully');
      }
      
      setShowModal(false);
      setEditingSchool(null);
      fetchSchools();
    } catch (error) {
      console.error('School submission error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // Handle validation errors - show all errors
      if (error.response?.status === 400 && error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          // Show first error as main toast
          toast.error(validationErrors[0].msg || 'Validation failed');
          // Show additional errors if any
          validationErrors.slice(1).forEach((err, idx) => {
            setTimeout(() => {
              toast.error(`${err.param || 'Field'}: ${err.msg}`, { duration: 4000 });
            }, (idx + 1) * 500);
          });
        } else {
          toast.error(error.response.data.message || 'Validation failed');
        }
      } else if (error.response?.status === 404) {
        toast.error('API endpoint not found. Please check if the backend server is running.');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to save school');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Onboarding</h1>
        <button
          onClick={handleAddNew}
          className="btn-primary"
        >
          + Onboard New School
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">School Name</th>
                <th className="text-left p-3">Board</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Academic Year</th>
                <th className="text-left p-3">Capacity</th>
                <th className="text-left p-3">Counselors</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-gray-500">
                    No schools found. Click "Onboard New School" to get started.
                  </td>
                </tr>
              ) : (
                schools.map((school) => (
                  <tr key={school.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{school.name}</td>
                    <td className="p-3">{school.board}</td>
                    <td className="p-3">{school.city}, {school.state}</td>
                    <td className="p-3">{school.academicYear}</td>
                    <td className="p-3">{school.capacity || 'N/A'}</td>
                    <td className="p-3">{school._count?.counselors || 0}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEdit(school)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-step Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingSchool ? 'Edit School' : 'Onboard New School'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex-1 flex items-center">
                  <div className={`flex-1 h-1 ${currentStep >= step ? 'bg-blue-600' : 'bg-gray-300'}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                    {step}
                  </div>
                  <div className={`flex-1 h-1 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-300'}`} />
                </div>
              ))}
            </div>

            <form 
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                // Prevent form submission on Enter key in step 3
                // Only allow submission via the submit button click
                if (currentStep === 3 && e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Basic Information</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">School Name {isSchoolFieldRequired('name') && <span className="text-red-500">*</span>}</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="input-field"
                      required={isSchoolFieldRequired('name')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Board {isSchoolFieldRequired('boards') && <span className="text-red-500">*</span>}</label>
                      <select
                        name="board"
                        value={formData.board}
                        onChange={handleInputChange}
                        className="input-field"
                        required={isSchoolFieldRequired('boards')}
                      >
                        <option value="CBSE">CBSE</option>
                        <option value="ICSE">ICSE</option>
                        <option value="STATE">State Board</option>
                        <option value="IGCSE">IGCSE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Academic Year *</label>
                      <input
                        type="text"
                        name="academicYear"
                        value={formData.academicYear}
                        onChange={handleInputChange}
                        placeholder="2024-2025"
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Location & Contact */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">Location & Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">City {isSchoolFieldRequired('city') && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="input-field"
                        required={isSchoolFieldRequired('city')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">State {isSchoolFieldRequired('state') && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        className="input-field"
                        required={isSchoolFieldRequired('state')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Address {isSchoolFieldRequired('address') && <span className="text-red-500">*</span>}</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="input-field"
                      rows="3"
                      required={isSchoolFieldRequired('address')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Email</label>
                      <input
                        type="email"
                        name="contactEmail"
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity</label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      className="input-field"
                      min="1"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Pockets (Departments/Programs) */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">School Pockets (Departments/Programs)</h3>
                  {formData.pockets.map((pocket, index) => (
                    <div key={index} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">Pocket {index + 1}</span>
                        {formData.pockets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePocket(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Pocket name (e.g., Science Department)"
                          value={pocket.name}
                          onChange={(e) => handlePocketChange(index, 'name', e.target.value)}
                          className="input-field"
                        />
                        <textarea
                          placeholder="Description (optional)"
                          value={pocket.description}
                          onChange={(e) => handlePocketChange(index, 'description', e.target.value)}
                          className="input-field"
                          rows="2"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPocket}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    + Add Another Pocket
                  </button>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-6">
                <div>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="btn-secondary"
                    >
                      Previous
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="btn-primary"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary"
                    >
                      {submitting ? 'Saving...' : editingSchool ? 'Update School' : 'Onboard School'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolOnboarding;
