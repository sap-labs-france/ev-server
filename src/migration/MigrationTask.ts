
export default abstract class MigrationTask {
  public isAsynchronous(): boolean {
    return false;
  }

  public abstract migrate(): Promise<void>;

  public abstract getVersion(): string;

  public abstract getName(): string;
}
