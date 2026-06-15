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
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageToBlob = void 0;
const storage_blob_1 = require("@azure/storage-blob");
const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const uploadImageToBlob = (file, fileName) => __awaiter(void 0, void 0, void 0, function* () {
    const containerClient = blobServiceClient.getContainerClient('label-images');
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    yield blockBlobClient.uploadData(file.buffer);
    return blockBlobClient.url;
});
exports.uploadImageToBlob = uploadImageToBlob;
