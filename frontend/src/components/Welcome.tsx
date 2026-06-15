import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUploadModal from './ImageUploadModal';
import type { ILabel } from '@shared/types/labelTypes';

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [importedRecords, setImportedRecords] = useState<ILabel[]>([]);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);

  const handleManualEntry = (): void => {
    navigate('/label-verification-app/data-entry');
  };

  const handleViewList = (): void => {
    navigate('/label-verification-app/list');
  };

  const handleFileUploadClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadStatus('Please upload a valid .csv file');
      return;
    }

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      setUploadStatus('Uploading...');
      const response = await fetch('/api/labels/upload-csv', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Upload failed');
      }

      const data: { recordCount: number; records: ILabel[]; error?: string; message?: string } = await response.json();

      if (data.error) {
        setUploadStatus(`Error: ${data.error}`);
        return;
      }

      setUploadStatus(data.message || `File processed. ${data.recordCount} records added.`);
      setImportedRecords(data.records ?? []);

      if (data.recordCount > 0) {
        setShowImageModal(true);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleModalComplete = (): void => {
    setShowImageModal(false);
    setUploadStatus('All images uploaded successfully. Redirecting...');
    setTimeout(() => navigate('/label-verification-app/list'), 1500);
  };

  const handleModalSkip = (): void => {
    setShowImageModal(false);
    navigate('/label-verification-app/list');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">
        Label Verification System
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Select an option to proceed
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={handleManualEntry}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          Manually Enter Label Data
        </button>

        <button
          onClick={handleFileUploadClick}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          Upload CSV File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={handleViewList}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
        >
          View Current Items
        </button>
      </div>

      {uploadStatus && (
        <p className="mt-6 text-gray-700 text-sm text-center">
          {uploadStatus}
        </p>
      )}

      {showImageModal && (
        <ImageUploadModal
          records={importedRecords}
          onComplete={handleModalComplete}
          onSkip={handleModalSkip}
        />
      )}
    </div>
  );
};

export default Welcome;
