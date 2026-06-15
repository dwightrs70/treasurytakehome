export type SourceOfProduct = 'DOMESTIC' | 'IMPORTED';
export type ProductType = 'WINE' | 'DISTILLED SPIRITS' | 'MALT BEVERAGE';

export interface ILabel {
  _id?: string;
  brand: string;
  classType: string; // e.g., "TABLE WINE RED" - from class_type.csv description
  alcContent?: string; // e.g., "11.5" or "55.5%"
  netContents: string; // e.g., "750 MILLILITERS" or "750 mL"
  producerName: string;
  producerAddressLine1: string;
  producerAddressLine2: string;
  producerAddressLine3: string; // Optional, can be empty string
  sourceOfProduct: SourceOfProduct;
  countryOfOrigin: string; // Required only if sourceOfProduct is IMPORTED
  productType: ProductType;
  imageFilenames: string[]; // 1 to 3 filenames (front, back, other)
  imageUrls: string[]; // URLs in Azure Blob Storage
  brandMatch: number;
  alcMatch: number;
  netContentMatch: number;
  warningSignatureMatch: number;
  fullWarningMatch: number;
}

export interface IVerifyResponse {
  id: string;
  brandMatch: number;
  alcMatch: number;
  netContentMatch: number;
  warningSignatureMatch: number;
  fullWarningMatch: number;
}
