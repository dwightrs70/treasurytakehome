"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLabels = exports.uploadCSV = exports.uploadImage = exports.deleteLabelsBatch = exports.deleteLabel = exports.updateLabel = exports.createLabel = exports.getLabelById = exports.getLabels = void 0;
const axios_1 = __importDefault(require("axios"));
const Label_1 = __importDefault(require("../models/Label"));
const azureStorage_1 = require("../utils/azureStorage");
// GET /api/labels - Fetch all labels
const getLabels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const labels = yield Label_1.default.find().sort({ createdAt: -1 });
        res.status(200).json(labels);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch labels' });
    }
});
exports.getLabels = getLabels;
// GET /api/labels/:id - Fetch a single label
const getLabelById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const label = yield Label_1.default.findById(req.params.id);
        if (!label) {
            res.status(404).json({ error: 'Label not found' });
            return;
        }
        res.status(200).json(label);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch label' });
    }
});
exports.getLabelById = getLabelById;
// POST /api/labels - Create a new label
const createLabel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const newLabel = yield Label_1.default.create(req.body);
        res.status(201).json(newLabel);
    }
    catch (err) {
        res.status(400).json({ error: 'Failed to create label', details: err });
    }
});
exports.createLabel = createLabel;
// PUT /api/labels/:id - Update an existing label
const updateLabel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const updatedLabel = yield Label_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedLabel) {
            res.status(404).json({ error: 'Label not found' });
            return;
        }
        res.status(200).json(updatedLabel);
    }
    catch (err) {
        res.status(400).json({ error: 'Failed to update label', details: err });
    }
});
exports.updateLabel = updateLabel;
// DELETE /api/labels/:id - Delete a label
const deleteLabel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const deletedLabel = yield Label_1.default.findByIdAndDelete(req.params.id);
        if (!deletedLabel) {
            res.status(404).json({ error: 'Label not found' });
            return;
        }
        res.status(200).json({ message: 'Label deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete label' });
    }
});
exports.deleteLabel = deleteLabel;
// POST /api/labels/delete-batch - Delete multiple labels at once
const deleteLabelsBatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { labelIds } = req.body;
    if (!labelIds || labelIds.length === 0) {
        res.status(400).json({ error: 'No labels provided' });
        return;
    }
    try {
        const result = yield Label_1.default.deleteMany({ _id: { $in: labelIds } });
        res.status(200).json({
            message: `Successfully deleted ${result.deletedCount} labels`,
            deletedCount: result.deletedCount
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Delete failed', details: err });
    }
});
exports.deleteLabelsBatch = deleteLabelsBatch;
// POST /api/labels/upload-image - Upload image to Azure Blob Storage
const uploadImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    try {
        const fileName = req.body.filename || req.file.originalname;
        const imageUrl = yield (0, azureStorage_1.uploadImageToBlob)(req.file, fileName);
        // Update the label record with the new image URL if a matching filename is found
        const updatedLabel = yield Label_1.default.findOneAndUpdate({ imageFilenames: fileName }, { $addToSet: { imageUrls: imageUrl } }, { new: true });
        res.status(200).json({
            imageUrl,
            imageFilename: fileName,
            labelUpdated: !!updatedLabel
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Image upload failed', details: err });
    }
});
exports.uploadImage = uploadImage;
// POST /api/labels/upload-csv - Process CSV file and create records
const uploadCSV = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded', recordCount: 0 });
        return;
    }
    try {
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter((line) => line.trim() !== '');
        // Handle empty file
        if (lines.length === 0) {
            res.status(400).json({ error: 'File is empty', recordCount: 0 });
            return;
        }
        // CSV parser that handles quoted fields
        const parseCSVLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                }
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                }
                else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };
        const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
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
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] || '';
            });
            // Collect all non-empty image filenames
            const imageFilenames = [
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
                sourceOfProduct: sourceOfProduct,
                countryOfOrigin: record['countryoforigin'] || '',
                productType: record['producttype'].toUpperCase(),
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
        const insertedRecords = yield Label_1.default.insertMany(records);
        res.status(201).json({
            message: `Successfully imported ${insertedRecords.length} records`,
            recordCount: insertedRecords.length,
            records: insertedRecords
        });
    }
    catch (err) {
        res.status(500).json({ error: 'CSV processing failed', details: err });
    }
});
exports.uploadCSV = uploadCSV;
// POST /api/labels/verify - Send selected labels to Azure ML endpoint
const verifyLabels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { labelIds } = req.body;
    if (!labelIds || labelIds.length === 0) {
        res.status(400).json({ error: 'No labels provided' });
        return;
    }
    try {
        const labels = yield Label_1.default.find({ _id: { $in: labelIds } });
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
        labels.forEach((label, index) => {
            console.log("label contents");
            console.log(`${label._id}`);
            console.log(`${label.brand}`);
            console.log(`${label.classType}`);
            console.log(`${label.alcContent}`);
            console.log(`${label.netContents}`);
            console.log(`${label.producerName}`);
            console.log(`${label.producerAddressLine1}`);
            console.log(`${label.producerAddressLine2}`);
            console.log(`${label.producerAddressLine3}`);
            console.log(`${label.sourceOfProduct}`);
            console.log(`${label.countryOfOrigin}`);
            console.log(`${label.productType}`);
            console.log(`${label.imageFilenames}`);
            console.log(`${label.imageUrls}`);
            console.log(`${label.brandMatch}`);
            console.log(`${label.alcMatch}`);
            console.log(`${label.netContentMatch}`);
            console.log(`${label.warningSignatureMatch}`);
            console.log(`${label.fullWarningMatch}`);
            label.countryOfOrigin = "";
            console.log(`${label.countryOfOrigin}`);
        });
        // Call the FastAPI endpoint
        const mlServiceUrl = process.env.AZURE_ML_ENDPOINT;
        const mlApiKey = process.env.AZURE_ML_API_KEY;
        const response = yield axios_1.default.post(mlServiceUrl, { data: labels }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': mlApiKey
            }
        });
        // *** DEBUG: Log the response from FastAPI ***
        console.log('FastAPI response:', JSON.stringify(response.data, null, 2));
        // Update database with verification results
        for (const result of response.data.results) {
            console.log(`Updating label ${result.id} with isVerified=${result.match}`);
            if (result.id) {
                yield Label_1.default.findByIdAndUpdate(result.id, {
                    brandMatch: result.brandMatch,
                    alcMatch: result.alcMatch,
                    netContentMatch: result.netContentMatch,
                    warningSignatureMatch: result.warningSignatureMatch,
                    fullWarningMatch: result.fullWarningMatch,
                });
            }
            else {
                console.warn('Result has no id, skipping update');
            }
        }
        res.status(200).json(response.data);
    }
    catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Verification service error', details: err });
    }
});
exports.verifyLabels = verifyLabels;
