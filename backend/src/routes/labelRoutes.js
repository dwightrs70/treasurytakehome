"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const labelController_1 = require("../controllers/labelController");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// CRUD routes
router.get('/', labelController_1.getLabels);
router.get('/:id', labelController_1.getLabelById);
router.post('/', labelController_1.createLabel);
router.put('/:id', labelController_1.updateLabel);
router.delete('/:id', labelController_1.deleteLabel);
// File upload routes
router.post('/upload-image', upload.single('image'), labelController_1.uploadImage);
router.post('/upload-csv', upload.single('csvFile'), labelController_1.uploadCSV);
router.post('/delete-batch', labelController_1.deleteLabelsBatch);
// Verification route
router.post('/verify', labelController_1.verifyLabels);
exports.default = router;
