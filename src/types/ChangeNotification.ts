export default interface ChangeNotification {
  tenantID: string;
  entity: string;
  action?: string;
  data?: {
    id: string;
    type: string;
  };
}
