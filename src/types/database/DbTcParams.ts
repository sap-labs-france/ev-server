export default interface DbTcParams {
  transactionId?: number;
  search?: string;
  userIDs?: string[];
  siteAdminIDs?: string[];
  chargeBoxIDs?: string[];
  siteAreaIDs?: string[];
  siteID?: string;
  connectorId?: number;
  startDateTime?: Date;
  endDateTime?: Date;
  stop?: any;
  refundType?: 'refunded' | 'notRefunded';
  minimalPrice?: boolean;
  withChargeBoxes?: boolean;
  statistics?: 'refund' | 'history';
  refundStatus?: string;
  errorType?: ('negative_inactivity' | 'average_consumption_greater_than_connector_capacity' | 'no_consumption')[];
}
