export default interface ChangeNotification {
  tenantID: string;
  entity: string;
  action?: string;
}
