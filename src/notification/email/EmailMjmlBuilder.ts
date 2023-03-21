import EmailComponentManager, { EmailComponent } from './EmailComponentManager';

import mjmlTemplate from './EmailMjmlTemplate';

export default class MjmlBuilder {
  private header: string;
  private body: string[];
  private footer: string;
  private config: string;

  public constructor() {
    this.header = '';
    this.footer = '';
    this.config = '';
    this.body = [];
  }

  public static async initialize(): Promise<MjmlBuilder> {
    const instance = new MjmlBuilder();
    instance.addConfig(await EmailComponentManager.getComponent(EmailComponent.MJML_CONFIG))
      .addHeader(await EmailComponentManager.getComponent(EmailComponent.MJML_HEADER))
      .addFooter(await EmailComponentManager.getComponent(EmailComponent.MJML_FOOTER));
    return instance;
  }

  public addHeader(header: string): this {
    this.header = header;
    return this;
  }

  public addToBody(component: string): this {
    if (component) {
      this.body.push(component);
    }
    return this;
  }

  public addFooter(footer: string): this {
    this.footer = footer;
    return this;
  }

  public addConfig(config: string): this {
    this.config = config;
    return this;
  }

  public buildTemplate(): mjmlTemplate {
    const template =
      '<mjml>' +
      this.config +
      '<mj-body background-color="#308080">' +
      this.header +
      this.body.join() +
      this.footer +
      '</mj-body>' +
      '</mjml>';
    return new mjmlTemplate(template);
  }
}
