import User from '../entity/User';

export default class UnauthorizedError extends Error {
  constructor(
    readonly action: string,
    readonly entity: string,
    readonly value: string,
    readonly user: User)
  {
    super(`Not authorized to perform '${action}' on '${entity}' ${(value ? "'" + value + "' " : " ")}(Role='${user.getRole()}')`);
  }
};
