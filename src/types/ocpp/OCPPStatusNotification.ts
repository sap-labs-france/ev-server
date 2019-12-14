export interface OCPPStatusNotification {
  connectorId: string;
  errorCode: string;
  info: string;
  status: string;
  timestamp: Date;
  vendorId: string;
  vendorErrorCode: string;
}

export interface DBOCPPStatusNotification extends OCPPStatusNotification {
  chargeBoxID: string;
  timestamp: Date;
  timezone: string;
}
