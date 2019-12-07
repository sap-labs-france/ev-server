export interface OCPPBootNotification {
  endpoint: string;
  id: string;
  chargeBoxID: string;
  currentIPAddress: string;
  ocppProtocol: string;
  ocppVersion: string;
  lastHeartBeat: Date;
  timestamp: Date;
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber: string;
  chargeBoxSerialNumber: string;
  firmwareVersion: string;
}
