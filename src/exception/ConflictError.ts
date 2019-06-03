export default class ConflictError extends Error {

  public constructor(
    message: string,
    readonly messageKey: string,
    readonly messageParams: any)
  {
    super(message);
  }
};
