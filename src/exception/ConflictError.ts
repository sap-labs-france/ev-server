export default class ConflictError extends Error {
  readonly messageKey: string;
  readonly messageParams: any;

  public constructor(message: string, messageKey: string, messageParams: any) {
    super(message);
  }
}
