import { BlobServiceClient } from '@azure/storage-blob';
import { Request } from 'express';

const blobServiceClient: BlobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING as string
);

export const uploadImageToBlob = async (
  file: Express.Multer.File,
  fileName: string
): Promise<string> => {
  const containerClient = blobServiceClient.getContainerClient('label-images');
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  await blockBlobClient.uploadData(file.buffer);
  return blockBlobClient.url;
};
