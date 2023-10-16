import { ReservationStatusEnum, ReservationType } from '../Reservation';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpReservationGetRequest extends HttpByIDRequest {
  WithUser?: boolean;
  WithChargingStation?: boolean;
  WithSite?: boolean;
  WithSiteArea?: boolean;
  WithCar?: boolean;
  WithTag?: boolean;
}

export interface HttpReservationsGetRequest extends HttpDatabaseRequest {
  Search: string;
  ReservationID: string;
  ChargingStationID: string;
  ConnectorID: string;
  UserID: string;
  CarID: string;
  SiteID: string;
  SiteAreaID: string;
  CompanyID: string;
  StartDateTime: Date;
  EndDateTime: Date;
  ArrivalTime?: Date;
  DepartureTime?: Date;
  Status: ReservationStatusEnum;
  Type: ReservationType;
  WithUser: boolean;
  WithChargingStation: boolean;
  WithCar: boolean;
  WithTag: boolean;
  WithCompany: boolean;
  WithSite: boolean;
  WithSiteArea: boolean;
}

export interface HttpReservationCreateRequest {
  id: number;
  chargingStationID: string;
  connectorID: number;
  fromDate: Date;
  toDate: Date;
  expiryDate: Date;
  arrivalTime?: Date;
  departureTime?: Date;
  idTag: string;
  visualTagID: string;
  parentIdTag?: string;
  userID?: string;
  carID?: string;
  type: ReservationType;
  status?: ReservationStatusEnum;
}

export interface HttpReservationUpdateRequest {
  id: number;
  chargingStationID: string;
  connectorID: number;
  fromDate: Date;
  toDate: Date;
  expiryDate: Date;
  arrivalTime?: Date;
  departureTime?: Date;
  idTag: string;
  visualTagID: string;
  parentIdTag?: string;
  userID?: string;
  carID?: string;
  type: ReservationType;
  status?: ReservationStatusEnum;
}

export interface HttpReservationDeleteRequest {
  ID: number;
}

export interface HttpReservationsDeleteRequest {
  reservationIDs: number[];
}

export interface HttpReservationCancelRequest {
  ID: number;
  args: {
    chargingStationID: string;
    connectorID: number;
  };
}
