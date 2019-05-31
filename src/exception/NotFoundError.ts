export default class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}
