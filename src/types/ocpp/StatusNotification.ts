export interface StatusNotification {
  connectorId: string;
  errorCode: string;
  info: string;
  status: string;
  timestamp: Date;
  vendorId: string;
  vendorErrorCode: string;
}

export interface DBStatusNotification extends StatusNotification {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}
