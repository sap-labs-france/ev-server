import { ChargePoint, ConnectorType, CurrentType, PhaseAssignmentToGrid, Voltage } from '../ChargingStation';
import { OCPPAvailabilityType, OCPPResetType } from '../ocpp/OCPPClient';

import { ChargingRateUnitType } from '../ChargingProfile';
import HttpByIDRequest from './HttpByIDRequest';
import HttpDatabaseRequest from './HttpDatabaseRequest';

export interface HttpSmartChargingTriggerRequest {
  SiteAreaID: string;
}

export interface HttpChargingStationLimitPowerRequest {
  chargingStationID: string;
  chargePointID: number;
  ampLimitValue: number;
  forceUpdateChargingPlan: boolean;
}

export interface HttpChargingProfilesGetRequest extends HttpDatabaseRequest {
  Search?: string;
  ChargingStationID?: string;
  ConnectorID?: number;
  WithChargingStation?: boolean;
  WithSiteArea?: boolean;
  SiteID?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpChargingProfileRequest extends HttpByIDRequest {
}

export interface HttpDownloadQrCodeRequest {
  ChargingStationID?: string;
  ConnectorID?: number;
  SiteID?: string;
  SiteAreaID?: string;
}

export interface HttpChargingStationsGetRequest extends HttpDatabaseRequest {
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
  Public?: boolean,
}

export interface HttpChargingStationsInErrorGetRequest extends HttpDatabaseRequest {
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

export interface HttpChargingStationGetRequest extends HttpByIDRequest {
  ID: string;
  WithSite?: boolean,
  WithSiteArea?: boolean;
}

export interface HttpChargingStationOcppGetRequest {
  ChargingStationID: string;
}

export interface HttpChargingStationConnectorGetRequest {
  ChargingStationID: string;
  ConnectorID: number;
}

export interface HttpChargingStationOcppParametersGetRequest {
  chargingStationID: string;
  forceUpdateOCPPParamsFromTemplate: boolean;
}

export interface HttpChargingStationMaxIntensitySocketSetRequest extends HttpChargingStationCommandRequest {
  carID?: string;
  userID?: string;
  maxIntensity?: number;
  args?: {maxIntensity: number};
}

export interface HttpChargingStationCommandRequest {
  chargingStationID: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpChargingStationCacheClearCommandRequest extends HttpChargingStationCommandRequest {
}

export interface HttpChargingStationAvailabilityChangeRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number,
    type: OCPPAvailabilityType;
  }
}

export interface HttpChargingStationConfigurationChangeRequest extends HttpChargingStationCommandRequest {
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

export interface HttpChargingStationTransactionStartRequest extends HttpChargingStationCommandRequest {
  carID?: string,
  userID?: string,
  carStateOfCharge?: number,
  carOdometer?: number,
  departureTime?: Date,
  targetStateOfCharge?: number,
  args: {
    connectorId: number,
    tagID?: string,
    visualTagID?: string,
  }
}

export interface HttpChargingStationTransactionStopRequest extends HttpChargingStationCommandRequest {
  args: {
    transactionId: number
  }
}

export interface HttpChargingStationCommandConfigurationGetRequest extends HttpChargingStationCommandRequest {
  args: {
    key: string[]
  }
}

export interface HttpChargingStationCompositeScheduleGetRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number,
    duration: number,
    chargingRateUnit?: ChargingRateUnitType
  }
}

export interface HttpChargingStationCommandConnectorUnlockRequest extends HttpChargingStationCommandRequest {
  args: {
    connectorId: number
  }
}

export interface HttpChargingStationFirmwareUpdateRequest extends HttpChargingStationCommandRequest {
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

export interface HttpChargingStationFirmwareGetRequest {
  FileName: string;
}

export interface HttpChargingStationDiagnosticsGetRequest extends HttpChargingStationCommandRequest {
  args: {
    location: string,
    retries?: number,
    retryInterval?: number,
    startTime?: Date,
    stopTime?: Date
  }
}
