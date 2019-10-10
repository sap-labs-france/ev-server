export default interface Notification {
  userID: string;
  timestamp: Date;
  channel: string;
  sourceId: string;
  sourceDescr: string;
  data: any;
  chargeBoxID: string;
}
