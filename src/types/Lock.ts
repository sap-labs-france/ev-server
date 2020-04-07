export default interface Lock {
  id?: string;
  name: string;
  type: string;
  timestamp: Date;
  hostname: string;
}
