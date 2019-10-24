import i18n, { ToNumberOptions, ToCurrencyOptions, ToPercentageOptions } from "i18n-js";
import global from '../types/GlobalType';
import moment from "moment";
import Constants from "./Constants";

export default class I18nManager {
  public static async initialize() {
    // Get the supported locales
    require("moment/locale/fr");
    require("moment/locale/de");
    require("moment/locale/en-gb");
    // Get languages
    const enJsonLanguage = await import(`${global.appRoot}/assets/i18n/en.json`);
    const frJsonLanguage = await import(`${global.appRoot}/assets/i18n/fr.json`);
    // Set tranlation files
    i18n.translations['en'] = enJsonLanguage;
    i18n.translations['fr'] = frJsonLanguage;
    // Default
    i18n.locale = Constants.DEFAULT_LANGUAGE;
    moment.locale(Constants.DEFAULT_LANGUAGE);
  }

  public static switchLocale(locale: string) {
    i18n.locale = locale;
    moment.locale(locale);
  }

  public static formatNumber(value: number, options: ToNumberOptions = { strip_insignificant_zeros: true }): string {
    return i18n.toNumber(value, options);
  }

  public static formatCurrency(value: number, options: ToCurrencyOptions = { precision: 0 }): string {
    return i18n.toCurrency(value, options);
  }

  public static formatPercentage(value: number, options: ToPercentageOptions = { precision: 0 }): string {
    return i18n.toPercentage(value, options);
  }

  public static formatDateTime(value: Date, format: string = 'LLL') {
    return moment(value).format(format);
  }
}