export default class BadRequestError extends Error {
  public constructor(readonly details: {path?: string; message: string}) {
    super(details && details.message ? details.message : 'Invalid request payload');
  }
}
