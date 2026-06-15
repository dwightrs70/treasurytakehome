import { Schema, model, Document } from 'mongoose';
import { ILabel } from '@shared/types/labelTypes';

const LabelSchema: Schema = new Schema({
  brand: { type: String, required: true },
  classType: { type: String, required: true },
  alcContent: { type: String, default: '' },
  netContents: { type: String, required: true },
  producerName: { type: String, required: true },
  producerAddressLine1: { type: String, required: true },
  producerAddressLine2: { type: String, required: true },
  producerAddressLine3: { type: String, default: '' },
  sourceOfProduct: { type: String, enum: ['DOMESTIC', 'IMPORTED'], required: true },
  countryOfOrigin: { type: String, default: '' },
  productType: { type: String, enum: ['WINE', 'DISTILLED SPIRITS', 'MALT BEVERAGE'], required: true },
  imageFilenames: { type: [String], default: [] },
  imageUrls: { type: [String], default: [] },
  brandMatch: { type: Number, default: -1.0 },
  alcMatch: { type: Number, default: -1.0 },
  netContentMatch: { type: Number, default: -1.0 },
  warningSignatureMatch: { type: Number, default: -1.0 },
  fullWarningMatch: { type: Number, default: -1.0 }
});

export default model<ILabel & Document>('Label', LabelSchema);
