import { Request, Response } from 'express';
import axios, { AxiosResponse } from 'axios';
import Label from '../models/Label';
import { ILabel, IVerifyResponse } from '@shared/types/labelTypes';
import { uploadImageToBlob } from '../utils/azureStorage';

// GET /api/labels - Fetch all labels
export const getLabels = async (req: Request, res: Response): Promise<void> => {
  try {
    const labels: ILabel[] = await Label.find().sort({ createdAt: -1 });
    res.status(200).json(labels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
};

// GET /api/labels/:id - Fetch a single label
export const getLabelById = async (req: Request, res: Response): Promise<void> => {
  try {
    const label: ILabel | null = await Label.findById(req.params.id);
    if (!label) {
      res.status(404).json({ error: 'Label not found' });
      return;
    }
    res.status(200).json(label);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch label' });
  }
};

// POST /api/labels - Create a new label
export const createLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const newLabel: ILabel = await Label.create(req.body);
    res.status(201).json(newLabel);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create label', details: err });
  }
};

// PUT /api/labels/:id - Update an existing label
export const updateLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedLabel: ILabel | null = await Label.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedLabel) {
      res.status(404).json({ error: 'Label not found' });
      return;
    }
    res.status(200).json(updatedLabel);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update label', details: err });
  }
};

// DELETE /api/labels/:id - Delete a label
export const deleteLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedLabel: ILabel | null = await Label.findByIdAndDelete(req.params.id);
    if (!deletedLabel) {
      res.status(404).json({ error: 'Label not found' });
      return;
    }
    res.status(200).json({ message: 'Label deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete label' });
  }
};

// POST /api/labels/delete-batch - Delete multiple labels at once
export const deleteLabelsBatch = async (req: Request, res: Response): Promise<void> => {
  const { labelIds }: { labelIds: string[] } = req.body;

  if (!labelIds || labelIds.length === 0) {
    res.status(400).json({ error: 'No labels provided' });
    return;
  }

  try {
    const result = await Label.deleteMany({ _id: { $in: labelIds } });
    res.status(200).json({
      message: `Successfully deleted ${result.deletedCount} labels`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed', details: err });
  }
};

// POST /api/labels/upload-image - Upload image to Azure Blob Storage
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const fileName: string = req.body.filename || req.file.originalname;
    const imageUrl: string = await uploadImageToBlob(req.file, fileName);
    
    // Update the label record with the new image URL if a matching filename is found
    const updatedLabel = await Label.findOneAndUpdate(
      { imageFilenames: fileName },
      { $addToSet: { imageUrls: imageUrl } },
      { new: true }
    );

    res.status(200).json({ 
      imageUrl, 
      imageFilename: fileName,
      labelUpdated: !!updatedLabel
    });
  } catch (err) {
    res.status(500).json({ error: 'Image upload failed', details: err });
  }
};

// POST /api/labels/upload-csv - Process CSV file and create records
export const uploadCSV = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded', recordCount: 0 });
    return;
  }

  try {
    const csvContent: string = req.file.buffer.toString('utf-8');
    const lines: string[] = csvContent.split('\n').filter((line) => line.trim() !== '');

    // Handle empty file
    if (lines.length === 0) {
      res.status(400).json({ error: 'File is empty', recordCount: 0 });
      return;
    }

    // CSV parser that handles quoted fields
    const parseCSVLine = (line: string): string[] => {
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

    const headers: string[] = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

    // Validate required columns based on the new test_data.csv structure
    const requiredColumns = [
      'producername',
      'produceraddressline1',
      'produceraddressline2',
      'produceraddressline3',
      'sourceofproduct',
      'countryoforigin',
      'brand',
      'producttype',
      'classtype',
      'alccontent',
      'netcontents',
      'imagefilenamefront',
      'imagefilenameback',
      'imagefilenameother'
    ];

    const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        recordCount: 0
      });
      return;
    }

    // Handle malformed file (only header, no records)
    if (lines.length === 1) {
      res.status(200).json({
        message: 'CSV header recognized but no records found',
        recordCount: 0
      });
      return;
    }

    // Parse data rows
    const records: ILabel[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = parseCSVLine(lines[i]);
      const record: Record<string, string> = {};

      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });

      // Collect all non-empty image filenames
      const imageFilenames: string[] = [
        record['imagefilenamefront'],
        record['imagefilenameback'],
        record['imagefilenameother']
      ].filter((name) => name && name.trim() !== '');

      // Validate conditional required field
      const sourceOfProduct = record['sourceofproduct'].toUpperCase();
      if (sourceOfProduct === 'IMPORTED' && (!record['countryoforigin'] || record['countryoforigin'].trim() === '')) {
        res.status(400).json({
          error: `Row ${i}: Country of Origin is required when Source of Product is IMPORTED`,
          recordCount: 0
        });
        return;
      }

      records.push({
        brand: record['brand'],
        classType: record['classtype'],
        alcContent: record['alccontent'] || '',
        netContents: record['netcontents'],
        producerName: record['producername'],
        producerAddressLine1: record['produceraddressline1'],
        producerAddressLine2: record['produceraddressline2'],
        producerAddressLine3: record['produceraddressline3'] || '',
        sourceOfProduct: sourceOfProduct as 'DOMESTIC' | 'IMPORTED',
        countryOfOrigin: record['countryoforigin'] || '',
        productType: record['producttype'].toUpperCase() as 'WINE' | 'DISTILLED SPIRITS' | 'MALT BEVERAGE',
        imageFilenames,
        imageUrls: [],
        brandMatch: -1.0,
        alcMatch: -1.0,
        netContentMatch: -1.0,
        warningSignatureMatch: -1.0,
        fullWarningMatch: -1.0
      });
    }

    // Bulk insert into MongoDB
    const insertedRecords: ILabel[] = await Label.insertMany(records);

    res.status(201).json({
      message: `Successfully imported ${insertedRecords.length} records`,
      recordCount: insertedRecords.length,
      records: insertedRecords
    });
  } catch (err) {
    res.status(500).json({ error: 'CSV processing failed', details: err });
  }
};

// POST /api/labels/verify - Send selected labels to Azure ML endpoint
export const verifyLabels = async (req: Request, res: Response): Promise<void> => {
  const { labelIds }: { labelIds: string[] } = req.body;

  if (!labelIds || labelIds.length === 0) {
    res.status(400).json({ error: 'No labels provided' });
    return;
  }

  try {
    const labels: ILabel[] = await Label.find({ _id: { $in: labelIds } });

    // *** DEBUG: Log the labels being sent ***
    console.log(`Sending ${labels.length} labels to FastAPI`);
    if (labels.length > 0) {
      console.log(`First label _id: ${labels[0]._id}`);
      console.log(`First label brand: ${labels[0].brand}`);
    }

    if (labels.length === 0) {
      res.status(404).json({ error: 'No matching labels found' });
      return;
    }

   labels.forEach((label, index) =>{
      console.log("label contents")
      console.log(`${label._id}`)
      console.log(`${label.brand}`)
      console.log(`${label.classType}`)
      console.log(`${label.alcContent}`)
      console.log(`${label.netContents}`)
      console.log(`${label.producerName}`)
      console.log(`${label.producerAddressLine1}`)
      console.log(`${label.producerAddressLine2}`)
      console.log(`${label.producerAddressLine3}`)
      console.log(`${label.sourceOfProduct}`)
      console.log(`${label.countryOfOrigin}`)
      console.log(`${label.productType}`)
      console.log(`${label.imageFilenames}`)
      console.log(`${label.imageUrls}`)
      console.log(`${label.brandMatch}`)
      console.log(`${label.alcMatch}`)
      console.log(`${label.netContentMatch}`)
      console.log(`${label.warningSignatureMatch}`)
      console.log(`${label.fullWarningMatch}`)

      label.countryOfOrigin = ""
      console.log(`${label.countryOfOrigin}`)
    });

    // Call the FastAPI endpoint
    const mlServiceUrl: string = process.env.AZURE_ML_ENDPOINT as string;
    const mlApiKey: string = process.env.AZURE_ML_API_KEY as string;

    const response: AxiosResponse<any> = await axios.post(
      mlServiceUrl,
      { data: labels },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': mlApiKey
        }
      }
    );

    // *** DEBUG: Log the response from FastAPI ***
    console.log('FastAPI response:', JSON.stringify(response.data, null, 2));

    // Update database with verification results
    for (const result of response.data.results) {
      console.log(`Updating label ${result.id} with isVerified=${result.match}`);
      if (result.id) {
        await Label.findByIdAndUpdate(result.id, 
          {
            brandMatch: result.brandMatch,
            alcMatch: result.alcMatch,
            netContentMatch: result.netContentMatch,
            warningSignatureMatch: result.warningSignatureMatch,
            fullWarningMatch: result.fullWarningMatch,
          }
        );
      } else {
        console.warn('Result has no id, skipping update');
      }
    }

    res.status(200).json(response.data);
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification service error', details: err });
  }
};

