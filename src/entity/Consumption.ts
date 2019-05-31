export default class Consumption {
  //TODO: Check types
  constructor(
    readonly transactionId: string,
    readonly connectorId: string,
    readonly chargeBoxID: string,
    readonly siteAreaID: string,
    readonly siteID: string,
    readonly userID: string,
    readonly startedAt: string,
    readonly endedAt: string){}
    
};
