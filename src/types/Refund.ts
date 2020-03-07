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

export enum RefundType {
  QUICK = 'quick',
  REPORT = 'report',
}
