import { Router } from 'express';
import multer from 'multer';
import {
  getLabels,
  getLabelById,
  createLabel,
  updateLabel,
  deleteLabel,
  uploadImage,
  uploadCSV,
  verifyLabels,
  deleteLabelsBatch
} from '../controllers/labelController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// CRUD routes
router.get('/', getLabels);
router.get('/:id', getLabelById);
router.post('/', createLabel);
router.put('/:id', updateLabel);
router.delete('/:id', deleteLabel);

// File upload routes
router.post('/upload-image', upload.single('image'), uploadImage);
router.post('/upload-csv', upload.single('csvFile'), uploadCSV);
router.post('/delete-batch', deleteLabelsBatch);

// Verification route
router.post('/verify', verifyLabels);

export default router;
