import React, { useState, useRef } from 'react';
import type { ILabel } from '@shared/types/labelTypes';

interface IImageUploadModalProps {
  records: ILabel[];
  onComplete: () => void;
  onSkip: () => void;
}

const ImageUploadModal: React.FC<IImageUploadModalProps> = ({ records, onComplete, onSkip }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFilenames, setUploadedFilenames] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage('');

    try {
      const newFilenames: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        newFilenames.push(file.name);

        const formData = new FormData();
        formData.append('image', file);
        formData.append('filename', file.name);

        const response = await fetch('/api/labels/upload-image', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      setUploadedFilenames((prev) => [...prev, ...newFilenames]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Build a flat list of all expected filenames across all records
  const allExpectedFilenames: string[] = records.flatMap((r) => r.imageFilenames);

  // Get the count of unique filenames still pending
  const uniqueUploaded = Array.from(new Set(uploadedFilenames));
  const remainingCount = allExpectedFilenames.filter(
    (name) => !uniqueUploaded.includes(name)
  ).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Upload Label Images</h2>
        <p className="text-sm text-gray-600 mb-4">
          {remainingCount} of {allExpectedFilenames.length} images still needed.
          Select multiple files at once to speed things up.
        </p>

        {records.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto border border-gray-200 rounded p-2 text-sm">
            {records.map((record) => (
              <div key={record._id ?? record.brand} className="py-1">
                <span className="text-gray-700 font-medium">{record.brand}</span>
                {record.imageFilenames.length === 0 ? (
                  <span className="text-gray-400 ml-2">No images required</span>
                ) : (
                  <ul className="ml-4 mt-1">
                    {record.imageFilenames.map((filename) => {
                      const isUploaded = uniqueUploaded.includes(filename);
                      return (
                        <li key={filename} className="flex justify-between">
                          <span className="text-gray-600">{filename}</span>
                          <span className={isUploaded ? 'text-green-600' : 'text-gray-400'}>
                            {isUploaded ? '✓ Uploaded' : 'Pending'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="w-full text-lg text-red-600 mb-4"
        />

        {errorMessage && (
          <p className="text-red-600 text-sm mb-3">{errorMessage}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
          >
            Skip
          </button>
          <button
            onClick={onComplete}
            disabled={isUploading || remainingCount > 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
