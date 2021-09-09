import { Notification } from './Notification';
import Utils from '../../../../utils/Utils';

export class CCTransaction {
  public details: any;
  public notifications: Notification[];
  public amount: string;
  public chargePlanId: string;
  public chargingContractId: string;
  public chargeCode: string;
  public origin: any;
  public date: Date;
  public label: string;
  public relationshipType: any;
  public operationType: any;
  public sessionID: string;

  constructor(model) {
    for (const key of Object.keys(model['$attributes'])) {
      this[key] = model['$attributes'][key];
    }
    this.details = {};
    model.detail.map((detail) => detail['$attributes']).forEach(
      (detail) => {
        let value;
        switch (detail.type) {
          case 'decimal':
            value = Utils.convertToFloat(detail.value);
            break;
          case 'date':
            value = new Date(detail.value);
            break;
          case 'string':
          default:
            value = detail.value;
        }
        this.details[detail.name] = value;
      });
    if (model.notification) {
      if (Array.isArray(model.notification)) {
        this.notifications = model.notification.map((n) => new Notification(n));
      } else {
        this.notifications = [new Notification(model.notification)];
      }
    }

  }

  getAmount(): string {
    return this.amount;
  }

  getAmountValue(): number {
    return Utils.convertToFloat(this.getAmount().substr(4));
  }

  getChargePlanId(): string {
    return this.chargePlanId;
  }

  getChargingContractId(): string {
    return this.chargingContractId;
  }

  getChargeCode(): string {
    return this.chargeCode;
  }

  getOrigin() {
    return this.origin;
  }

  getDate() {
    return this.date;
  }

  getLabel(): string {
    return this.label;
  }

  getRelationshipType() {
    return this.relationshipType;
  }

  getOperationType() {
    return this.operationType;
  }

  getSessionID(): string {
    return this.sessionID;
  }

  getDetails() {
    return this.details;
  }
}
