import User from './User';

export default interface RefundReport {
  id?: string;
  user?: User;
}

export enum RefundStatus {
  SUBMITTED = 'submitted',
  NOT_SUBMITTED = 'notSubmitted',
  CANCELLED = 'cancelled',
  APPROVED = 'approved',
}

export enum ConcurRefundType {
  QUICK = 'quick',
  REPORT = 'report',
}

export interface ConcurLocation {
  Name: string;
  Country: string;
  CountrySubdivision: string;
  AdministrativeRegion: string;
  IATACode: string;
  IsBookingTool: boolean;
  IsAirport: boolean;
  Latitude: number;
  Longitude: number;
  ID: string;
  URI: string;
}

export interface TransactionRefundData {
  refundId: string;
  refundedAt: Date;
  reportId?: string;
  status?: RefundStatus;
}
