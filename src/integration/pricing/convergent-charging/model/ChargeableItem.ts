
export enum Type {
  number = 'number',
  string = 'string',
  date = 'date',
}

export class ChargeableItemProperty {
  public name: string;

  /**
   *
   * @param name
   * @param type {Type}
   * @param value
   */
  constructor(name: string, type: Type, value) {
    this.name = name;
    this[type + 'Value'] = value;
  }
}

export class ChargeableItem {
  public name: string;
  public userTechnicalId: string;
  public serviceId: string;
  public consumptionDate: Date;
  public property: ChargeableItemProperty[];

  /**
   *
   * @param name
   * @param userTechnicalId
   * @param serviceId
   * @param consumptionDate
   * @param properties {ChargeableItem[]}
   */
  constructor(name: string, userTechnicalId: string, serviceId: string, consumptionDate: Date, properties: ChargeableItemProperty[] = []) {
    this.name = name;
    this.userTechnicalId = userTechnicalId;
    this.serviceId = serviceId;
    this.consumptionDate = consumptionDate;
    this.property = properties;
  }
}

export class ConfirmationItem {
  public name: string;
  public property: ChargeableItemProperty[];

  /**
   *
   * @param name
   * @param properties {ChargeableItemProperty[]}
   */
  constructor(name: string, properties: ChargeableItemProperty[] = []) {
    this.name = name;
    this.property = properties;
  }
}

export class ReservationItem {
  public name: string;
  public property: ChargeableItemProperty[];

  /**
   *
   * @param name
   * @param properties {ChargeableItemProperty[]}
   */
  constructor(name: string, properties: ChargeableItemProperty[] = []) {
    this.name = name;
    this.property = properties;
  }
}

