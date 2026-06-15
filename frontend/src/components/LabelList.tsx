import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ILabel, IVerifyResponse } from '@shared/types/labelTypes';

const LabelList: React.FC = () => {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<ILabel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [verificationResults, setVerificationResults] = useState<IVerifyResponse[]>([]);

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchLabels();
  }, []);

  const fetchLabels = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/labels');
      if (!response.ok) {
        throw new Error('Failed to fetch labels');
      }
      const data: ILabel[] = await response.json();
      setLabels(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setEnlargedImage(null);
      }
    };
    if (enlargedImage) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [enlargedImage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.checked) {
      const allIds = labels
        .filter((label) => label._id)
        .map((label) => label._id as string);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string | undefined): void => {
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleEdit = (label: ILabel): void => {
    navigate('/label-verification-app/data-entry', {
      state: { from: 'list', label }
    });
  };

  const handleVerifySelected = async (): Promise<void> => {
    if (selectedIds.length === 0) {
      setErrorMessage('Please select at least one label to verify');
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage('');

      const response = await fetch('/api/labels/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelIds: selectedIds })
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const data: { results: IVerifyResponse[] } = await response.json();
      setVerificationResults(data.results);
      await fetchLabels();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }

    setSelectedIds([]);
  };

  const handleDeleteClick = (): void => {
    if (selectedIds.length === 0) {
      setErrorMessage('Please select at least one label to delete');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    try {
      setIsDeleting(true);
      setErrorMessage('');

      const response = await fetch('/api/labels/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelIds: selectedIds })
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setSelectedIds([]);
      setShowDeleteConfirm(false);
      await fetchLabels();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  
    setSelectedIds([]);
  };

  const handleDeleteCancel = (): void => {
    setShowDeleteConfirm(false);
  };

  const handleCancel = (): void => {
    navigate('/label-verification-app/welcome');
  };

  const isAllSelected: boolean =
    labels.length > 0 && selectedIds.length === labels.length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-8xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Label List</h1>
          <div className="flex gap-3">
            <button
              onClick={handleVerifySelected}
              disabled={isVerifying || selectedIds.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
            >
              {isVerifying ? 'Verifying...' : `Verify Selected (${selectedIds.length})`}
            </button>
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting || selectedIds.length === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
        )}

        {isLoading ? (
          <p className="text-gray-600">Loading labels...</p>
        ) : labels.length === 0 ? (
          <p className="text-gray-600">No labels found. Add one from the Welcome page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-700">
                  <th className="p-3 border-b">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-3 border-b">Producer</th>
                  <th className="p-3 border-b">Class/Type</th>
                  <th className="p-3 border-b">Source</th>
                  <th className="p-3 border-b">Brand</th>
                  <th className="p-3 border-b">Brand Match</th>
                  <th className="p-3 border-b">ABV</th>
                  <th className="p-3 border-b">ABV Match</th>
                  <th className="p-3 border-b">Net Contents</th>
                  <th className="p-3 border-b">Net Contents Match</th>
                  <th className="size-2 p-3 border-b">Warning Signature Match</th>
                  <th className="size-2 p-3 border-b">Full Warning Match</th>
                  <th className="p-3 border-b">Images</th>
                  <th className="p-3 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => {
                  const isSelected = label._id ? selectedIds.includes(label._id) : false;
                  const verificationResult = verificationResults.find(
                    (r) => r.id === label._id
                  );

                  return (
                    <tr key={label._id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(label._id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-3 border-b text-xs text-gray-800">
                        {label.producerName}
                      </td>
                      <td className="size-2 p-3 border-b text-xs text-gray-800">{label.classType}</td>
                      <td className="p-3 border-b text-xs text-gray-800">
                        {label.sourceOfProduct}
                        {label.sourceOfProduct === 'IMPORTED' && label.countryOfOrigin && (
                          <span className="text-gray-500 text-shadow-2xs block">
                            {label.countryOfOrigin}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b text-xs text-gray-800">{label.brand}</td>
                      <td className="p-3 border-b text-xs">
                        {verificationResult ? (
                          <span
                            className={
                                verificationResult.brandMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : verificationResult.brandMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : verificationResult.brandMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                              }
                            >
                              {(verificationResult.brandMatch < 0) ? ('Unverified') : (`${(verificationResult.brandMatch * 100).toFixed(0)}%`)}
                            </span>
                        ) : (
                          <span className= {
                                label.brandMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : label.brandMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : label.brandMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                          }
                          >
                            {(label.brandMatch < 0) ? ('Unverified') : (`${(label.brandMatch * 100).toFixed(0)}%`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b text-xs text-gray-800">{label.alcContent}</td>
                      <td className="p-3 border-b text-xs">
                        {verificationResult ? (
                          <span
                            className={
                                verificationResult.alcMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : verificationResult.alcMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : verificationResult.alcMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                              }
                            >
                              {(verificationResult.alcMatch < 0) ? ('Unverified') : (`${(verificationResult.alcMatch * 100).toFixed(0)}%`)}
                            </span>
                        ) : (
                          <span className= {
                                label.alcMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : label.alcMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : label.alcMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                          }
                          >
                            {(label.alcMatch < 0) ? ('Unverified') : (`${(label.alcMatch * 100).toFixed(0)}%`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b text-xs text-gray-800">{label.netContents}</td>
                      <td className="p-3 border-b text-xs">
                        {verificationResult ? (
                          <span
                            className={
                                verificationResult.netContentMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : verificationResult.netContentMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : verificationResult.netContentMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                              }
                            >
                              {(verificationResult.netContentMatch < 0) ? ('Unverified') : (`${(verificationResult.netContentMatch * 100).toFixed(0)}%`)}
                            </span>
                        ) : (
                          <span className= {
                                label.netContentMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : label.netContentMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : label.netContentMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                          }
                          >
                            {(label.netContentMatch < 0) ? ('Unverified') : (`${(label.netContentMatch * 100).toFixed(0)}%`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b text-xs">
                        {verificationResult ? (
                          <span
                            className={
                                verificationResult.warningSignatureMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : verificationResult.warningSignatureMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : verificationResult.warningSignatureMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                              }
                            >
                              {(verificationResult.warningSignatureMatch < 0) ? ('Unverified') : (`${(verificationResult.warningSignatureMatch * 100).toFixed(0)}%`)}
                            </span>
                        ) : (
                          <span className= {
                                label.warningSignatureMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : label.warningSignatureMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : label.warningSignatureMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                          }
                          >
                            {(label.warningSignatureMatch < 0) ? ('Unverified') : (`${(label.warningSignatureMatch * 100).toFixed(0)}%`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b text-xs">
                        {verificationResult ? (
                          <span
                            className={
                                verificationResult.fullWarningMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : verificationResult.fullWarningMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : verificationResult.fullWarningMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                              }
                            >
                              {(verificationResult.fullWarningMatch < 0) ? ('Unverified') : (`${(verificationResult.fullWarningMatch * 100).toFixed(0)}%`)}
                            </span>
                        ) : (
                          <span className= {
                                label.fullWarningMatch == 1.0
                                  ? 'text-green-600 font-medium'
                                  : label.fullWarningMatch > 0.8
                                  ? 'text-yellow-600 font-medium'
                                  : label.fullWarningMatch >= 0.0
                                  ?  'text-red-600 font-medium'
                                  : 'text-gray-800'
                          }
                          >
                            {(label.fullWarningMatch < 0) ? ('Unverified') : (`${(label.fullWarningMatch * 100).toFixed(0)}%`)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-b">
                        {label.imageUrls && label.imageUrls.length > 0 ? (
                          <div className="flex gap-1">
                            {label.imageUrls.map((url, index) => (
                              <img
                                key={index}
                                src={url}
                                alt={`${label.brand} ${index + 1}`}
                                onClick={() => setEnlargedImage(url)}
                                className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-75 transition-opacity"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No images</span>
                        )}
                      </td>
                      <td className="p-3 border-b">
                        <button
                          onClick={() => handleEdit(label)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Confirm Deletion</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete {selectedIds.length} selected label(s)?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImage(null)} // Click backdrop to close
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-2 -right-2 bg-white text-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-gray-100"
            >
              ✕
            </button>
            <img 
              src={enlargedImage} 
              alt="Enlarged view" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()} // Prevent backdrop close when clicking the image
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default LabelList;
