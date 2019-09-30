export default class ComponentInactiveError extends Error {
  constructor(readonly params: {
    component: string;
    action: string;
    entity: string;
    errorCode: number;
    module: string;
    method: string;
  }) {
    super(`Component ${params.component} is inactive - Not allowed to perform '${params.action}' on '${params.entity}'`);
  }
}
