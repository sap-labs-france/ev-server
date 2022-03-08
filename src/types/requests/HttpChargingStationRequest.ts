import { ChargePoint, ConnectorType, CurrentType, PhaseAssignmentToGrid, Voltage } from '../ChargingStation';
import { OCPPAvailabilityType, OCPPResetType } from '../ocpp/OCPPClient';

import { ChargingRateUnitType } from '../ChargingProfile';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpTriggerSmartChargingRequest {
  SiteAreaID: string;
}

export interface HttpChargingStationLimitPowerRequest {
  chargingStationID: string;
  chargePointID: number;
  ampLimitValue: number;
  forceUpdateChargingPlan: boolean;
}

export interface HttpChargingProfilesRequest extends HttpDatabaseRequest {
  Search?: string;
  ChargingStationID?: string;
  ConnectorID?: number;
  WithChargingStation?: boolean;
  WithSiteArea?: boolean;
  SiteID?: string;
}

export interface HttpDownloadQrCodeRequest {
  ChargingStationID?: string;
  ConnectorID?: number;
  SiteID?: string;
  SiteAreaID?: string;
}

export interface HttpChargingStationsRequest extends HttpDatabaseRequest {
  Issuer?: boolean;
  Search?: string;
  WithNoSiteArea?: boolean;
  ConnectorStatus?: string;
  ConnectorType?: string;
  ChargingStationID?: string;
  SiteID?: string;
  CompanyID?: string;
  WithSite?: boolean;
  WithSiteArea?: boolean;
  SiteAreaID?: string;
  IncludeDeleted?: boolean;
  ErrorType?: string;
  LocLongitude?: number;
  LocLatitude?: number;
  LocCoordinates?: number[];
  LocMaxDistanceMeters?: number;
}

export interface HttpChargingStationsInErrorRequest extends HttpDatabaseRequest {
  Search?: string;
  SiteID?: string;
  SiteAreaID?: string;
  ErrorType?: string;
}

export interface HttpChargingStationParamsUpdateRequest {
  id: string;
  chargingStationURL: string;
  maximumPower: number;
  public: boolean;
  excludeFromSmartCharging: boolean;
  forceInactive: boolean;
  manualConfiguration: boolean;
  siteAreaID: string;
  coordinates: number[];
  chargePoints: ChargePoint[];
  connectors: {
    connectorId: number;
    chargePointID: number;
    type: ConnectorType;
    power: number;
    amperage: number;
    voltage: Voltage;
    currentType: CurrentType;
    numberOfConnectedPhase: number;
    phaseAssignmentToGrid: PhaseAssignmentToGrid;
    tariffID?: string;
  }[];
  tariffID?: string;
}

export interface HttpChargingStationRequest extends HttpByIDRequest {
  ID: string;
  WithSite?: boolean,
  WithSiteArea?: boolean;
}

export interface HttpChargingStationOcppRequest {
  ChargingStationID: string;
}

export interface HttpChargingStationConnectorRequest {
  ChargingStationID: string;
  ConnectorID: number;
}

export interface HttpChargingStationOcppParametersRequest {
  chargingStationID: string;
  forceUpdateOCPPParamsFromTemplate: boolean;
}

export interface HttpChargingStationSetMaxIntensitySocketRequest extends HttpChargingStationCommandRequest {
  carID?: string;
  userID?: string;
  maxIntensity?: number;
  args?: {maxIntensity: number};
}

export interface HttpChargingStationCommandRequest {
  chargingStationID: string;
}

export type HttpChargingStationCacheClearCommandRequest = HttpChargingStationCommandRequest;

export interface HttpChargingStationChangeAvailabilityRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number,
    type: OCPPAvailabilityType;
  }
}

export interface HttpChargingStationChangeConfigurationRequest extends HttpChargingStationCommandRequest {
  args: {
    key: string,
    value: string,
    custom?: boolean,
  }
}

export interface HttpChargingStationCommandDataTransferRequest extends HttpChargingStationCommandRequest {
  args: {
    vendorId: string,
    messageId?: string,
    data: string
  }
}

export interface HttpChargingStationReservationCancelRequest {
  chargingStationID: string,
  args: {
    reservationId: number;
  }
}

export interface HttpChargingStationStartTransactionRequest extends HttpChargingStationCommandRequest {
  carID?: string,
  userID?: string,
  carStateOfCharge?: number,
  carOdometer?: number,
  departureTime?: Date,
  args: {
    connectorId: number,
    tagID?: string,
    visualTagID?: string,
  }
}

export interface HttpChargingStationStopTransactionRequest extends HttpChargingStationCommandRequest {
  args: {
    transactionId: number
  }
}

export interface HttpChargingStationCommandGetConfigurationRequest extends HttpChargingStationCommandRequest {
  args: {
    key: string[]
  }
}

export interface HttpChargingStationGetCompositeScheduleRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number,
    duration: number,
    chargingRateUnit?: ChargingRateUnitType
  }
}

export interface HttpChargingStationCommandUnlockConnectorRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number
  }
}

export interface HttpChargingStationUpdateFirmwareRequest extends HttpChargingStationCommandRequest {
  args: {
    location: string,
    retries?: number,
    retryInterval?: number,
    retrieveDate: Date
  }
}

export interface HttpChargingStationReserveNowRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: string;
    expiryDate: Date;
    idTag: string;
    parentIdTag?: string;
    reservationId: number;
  }
}

export interface HttpChargingStationResetRequest extends HttpChargingStationCommandRequest {
  args: {
    type: OCPPResetType;
  }
}

export interface HttpIsAuthorizedRequest {
  Action: string;
  Arg1: any;
  Arg2: any;
  Arg3: any;
}

export interface HttpChargingStationGetFirmwareRequest {
  FileName: string;
}

export interface HttpChargingStationGetDiagnosticsRequest extends HttpChargingStationCommandRequest {
  args: {
    location: string,
    retries?: number,
    retryInterval?: number,
    startTime?: Date,
    stopTime?: Date
  }
}
