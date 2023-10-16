import { ReservationAuthorizationActions } from './Authorization';
import { Car } from './Car';
import ChargingStation from './ChargingStation';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ImportStatus } from './GlobalType';
import Tag from './Tag';

export default interface Reservation extends CreatedUpdatedProps, ReservationAuthorizationActions {
  id: number;
  chargingStationID: string;
  chargingStation?: ChargingStation;
  connectorID: number;
  fromDate?: Date;
  toDate?: Date;
  expiryDate: Date;
  arrivalTime?: Date | string;
  departureTime?: Date | string;
  idTag: string;
  visualTagID?: string;
  tag?: Tag;
  parentIdTag?: string;
  carID?: string;
  car?: Car;
  userID?: string;
  type: ReservationType;
  status?: ReservationStatusEnum;
}

export enum ReservationStatus {
  DONE = 'reservation_done',
  SCHEDULED = 'reservation_scheduled',
  IN_PROGRESS = 'reservation_in_progress',
  CANCELLED = 'reservation_cancelled',
  EXPIRED = 'reservation_expired',
  UNMET = 'reservation_unmet',
}

export enum ReservationType {
  PLANNED_RESERVATION = 'planned_reservation',
  RESERVE_NOW = 'reserve_now',
}

export const ReservationStatusEnum = { ...ReservationStatus };
export type ReservationStatusEnum = ReservationStatus;

export type ReservationStatusTransition = Readonly<{
  from?: ReservationStatusEnum;
  to: ReservationStatusEnum;
}>;

export interface ImportedReservation {
  id: number;
  chargingStationID: string;
  connectorID: number;
  importedBy?: string;
  importedOn?: Date;
  status?: ImportStatus;
  errorDescription?: string;
  fromDate: Date;
  toDate: Date;
  expiryDate: Date;
  arrivalTime?: Date;
  departureTime?: Date;
  idTag: string;
  parentIdTag?: string;
  carID?: string;
  type: ReservationType;
  importedData?: {
    autoActivateReservationAtImport: boolean;
  };
}
