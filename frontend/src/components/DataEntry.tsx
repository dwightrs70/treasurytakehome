import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchableSelect, { type ISelectOption } from './SearchableSelect';
import type { ILabel, SourceOfProduct, ProductType } from '@shared/types/labelTypes';

interface ILocationState {
  from?: 'list' | 'welcome';
  label?: ILabel;
}

const DataEntry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ILocationState | null;
  const isEditing: boolean = state?.from === 'list';
  const existingLabel: ILabel | undefined = state?.label;

  const [classTypeOptions, setClassTypeOptions] = useState<ISelectOption[]>([]);

  const [formData, setFormData] = useState<ILabel>(
    existingLabel ?? {
      brand: '',
      classType: '',
      alcContent: '',
      netContents: '',
      producerName: '',
      producerAddressLine1: '',
      producerAddressLine2: '',
      producerAddressLine3: '',
      sourceOfProduct: 'DOMESTIC' as SourceOfProduct,
      countryOfOrigin: '',
      productType: 'WINE' as ProductType,
      imageFilenames: [],
      imageUrls: [],
      brandMatch: -1.0,
      alcMatch: -1.0,
      netContentMatch: -1.0,
      warningSignatureMatch: -1.0,
      fullWarningMatch: -1.0
    }
  );

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    existingLabel?.imageUrls ?? []
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    fetch('/class_type.csv')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load class_type.csv: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        const lines = text.split('\n').filter((line) => line.trim() !== '');

        // CSV parser that handles quoted fields with commas
        const parseLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        // Use a Map to deduplicate by description (label)
        // If the same description appears multiple times, we keep the first one
        const uniqueMap = new Map<string, ISelectOption>();

        // Skip header row, parse each line
        lines.slice(1).forEach((line) => {
          const parts = parseLine(line);
          //const code = parts[0] ?? '';
          // Join everything after the first comma to handle descriptions with commas
          const description = parts.slice(1).join(',').trim();

          if (description && !uniqueMap.has(description)) {
            uniqueMap.set(description, {
              value: description,
              label: description
            });
          }
        });

        // Convert Map values to array and sort alphabetically for easier scanning
        const options: ISelectOption[] = Array.from(uniqueMap.values()).sort((a, b) =>
          a.label.localeCompare(b.label)
        );

        console.log(`Loaded ${options.length} unique class type options (from ${lines.length - 1} total rows)`);
        setClassTypeOptions(options);
      })
      .catch((err) => {
        console.error('Error loading class_type.csv:', err);
        setClassTypeOptions([]);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === 'sourceOfProduct' && value === 'DOMESTIC') {
      setFormData((prev) => ({ ...prev, sourceOfProduct: 'DOMESTIC', countryOfOrigin: '' }));
    }
  };

  const handleClassTypeChange = (value: string): void => {
    setFormData({ ...formData, classType: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    setImageFiles(fileArray);
    setFormData({
      ...formData,
      imageFilenames: fileArray.map((f) => f.name)
    });

    const previews = fileArray.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    try {
      let imageUrls = formData.imageUrls;
      if (imageFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (const file of imageFiles) {
          const imageFormData = new FormData();
          imageFormData.append('image', file);
          imageFormData.append('filename', file.name);

          const imageResponse = await fetch('/api/labels/upload-image', {
            method: 'POST',
            body: imageFormData
          });

          if (!imageResponse.ok) throw new Error('Image upload failed');
          const data = await imageResponse.json();
          uploadedUrls.push(data.imageUrl);
        }
        imageUrls = uploadedUrls;
      }

      const payload = { ...formData, imageUrls };
      const endpoint = isEditing
        ? `/api/labels/${existingLabel?._id}`
        : '/api/labels';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save label');
      navigate('/label-verification-app/list');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    navigate(isEditing ? '/label-verification-app/list' : '/label-verification-app/welcome');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEditing ? 'Edit Label' : 'New Label Entry'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
            <input type="text" name="brand" value={formData.brand} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class / Type</label>
            <SearchableSelect
              options={classTypeOptions}
              value={formData.classType}
              onChange={handleClassTypeChange}
              placeholder={
                classTypeOptions.length === 0
                  ? 'Loading class types...'
                  : 'Type to search class types...'
              }
              required
              name="classType"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alcohol Content (optional)
            </label>
            <input type="text" name="alcContent" value={formData.alcContent ?? ''} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Net Contents</label>
            <input type="text" name="netContents" value={formData.netContents} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Producer Information</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Producer Name</label>
                <input type="text" name="producerName" value={formData.producerName} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input type="text" name="producerAddressLine1" value={formData.producerAddressLine1} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input type="text" name="producerAddressLine2" value={formData.producerAddressLine2} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 3 (optional)</label>
                <input type="text" name="producerAddressLine3" value={formData.producerAddressLine3} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Classification</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source of Product</label>
                <select name="sourceOfProduct" value={formData.sourceOfProduct} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="DOMESTIC">DOMESTIC</option>
                  <option value="IMPORTED">IMPORTED</option>
                </select>
              </div>

              {formData.sourceOfProduct === 'IMPORTED' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                  <input type="text" name="countryOfOrigin" value={formData.countryOfOrigin} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                <select name="productType" value={formData.productType} onChange={handleChange} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="WINE">WINE</option>
                  <option value="DISTILLED SPIRITS">DISTILLED SPIRITS</option>
                  <option value="MALT BEVERAGE">MALT BEVERAGE</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label Images (front, back, other — up to 3)
            </label>
            <input type="file" accept="image/*" multiple onChange={handleImageChange}
              className="w-full text-lg text-red-600" />
            {imagePreviews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <img src={preview} alt={`Label preview ${index + 1}`}
                      className="max-w-37.5 max-h-32 border border-gray-200 rounded" />
                    <span className="text-xs text-gray-500 mt-1">
                      {imageFiles[index]?.name || formData.imageFilenames[index] || `Image ${index + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-red-600 text-sm">{errorMessage}</p>
          )}

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors">
              {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save'}
            </button>
            <button type="button" onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataEntry;
