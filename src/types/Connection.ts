
export default interface Connection {
  id?: string;
  connectorId: string;
  userId: string;
  data: any;
  createdAt?: Date;
  updatedAt?: Date;
  validUntil?: Date;
}

export enum ConnectionType {
  MERCEDES = 'mercedes',
  CONCUR = 'concur'
}
