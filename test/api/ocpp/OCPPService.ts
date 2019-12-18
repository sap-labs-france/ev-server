
export default abstract class OCPPService {
  public serverUrl: string;
  public constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public abstract getVersion(): string;

  public abstract executeAuthorize(chargeBoxIdentity, data): any;

  public abstract executeStartTransaction(chargeBoxIdentity, data): any;

  public abstract executeStopTransaction(chargeBoxIdentity, data): any;

  public abstract executeHeartbeat(chargeBoxIdentity, data): any;

  public abstract executeMeterValues(chargeBoxIdentity, data): any;

  public abstract executeBootNotification(chargeBoxIdentity, data): any;

  public abstract executeStatusNotification(chargeBoxIdentity, data): any;

  public abstract executeFirmwareStatusNotification(chargeBoxIdentity, data): any;

  public abstract executeDiagnosticsStatusNotification(chargeBoxIdentity, data): any;

  public abstract executeDataTransfer(chargeBoxIdentity, data): any;
}
