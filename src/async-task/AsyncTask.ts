import AsyncTask from '../types/AsyncTask';

const MODULE_NAME = 'AbstractAsyncTask';

export default abstract class AbstractAsyncTask {
  protected asyncTask: AsyncTask;

  public constructor(asyncTask: AsyncTask) {
    this.asyncTask = asyncTask;
  }

  public async run(): Promise<void> {
    // Hook
    await this.beforeAsyncTaskRun();
    // Process
    await this.executeAsyncTask();
    // Hook
    await this.afterAsyncTaskRun();
  }

  public async beforeAsyncTaskRun(): Promise<void> {
  }

  public async afterAsyncTaskRun(): Promise<void> {
  }

  protected abstract executeAsyncTask(): Promise<void>;
}
