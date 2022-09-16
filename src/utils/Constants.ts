import { OCPPAttribute, OCPPLocation, OCPPMeasurand, OCPPPhase, OCPPReadingContext, OCPPUnitOfMeasure, OCPPValueFormat } from '../types/ocpp/OCPPServer';

import DbParams from '../types/database/DbParams';
import { OcppParameter } from '../types/ChargingStation';
import Tenant from '../types/Tenant';

export default class Constants {
  public static readonly ONE_BILLION = 1000000000;

  public static readonly BOOT_NOTIFICATION_WAIT_TIME = 60;

  public static readonly CSV_SEPARATOR = ',';
  public static readonly CR_LF = '\r\n';

  public static readonly PERF_MAX_DATA_VOLUME_KB = 512;
  public static readonly PERF_MAX_RESPONSE_TIME_MILLIS = 1000;

  public static readonly AXIOS_DEFAULT_TIMEOUT_SECS = 30;

  public static readonly DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT = 80;
  public static readonly AMPERAGE_DETECTION_THRESHOLD = 0.5;

  public static readonly DB_RECORD_COUNT_DEFAULT = 100;
  public static readonly DB_RECORD_COUNT_MAX_PAGE_LIMIT = 1000;
  public static readonly DB_RECORD_COUNT_CEIL = 500;
  public static readonly DB_RECORD_COUNT_NO_LIMIT = Number.MAX_SAFE_INTEGER;
  public static readonly DB_UNDETERMINED_NBR_OF_RECORDS = -1;
  public static readonly DB_EMPTY_DATA_RESULT = Object.freeze({ count: 0, result: [] });

  public static readonly DB_PARAMS_MAX_LIMIT: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, sort: null });
  public static readonly DB_PARAMS_SINGLE_RECORD: DbParams = Object.freeze({ limit: 1, skip: 0, sort: null });
  public static readonly DB_PARAMS_DEFAULT_RECORD: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_DEFAULT, skip: 0, sort: null });
  public static readonly DB_PARAMS_COUNT_ONLY: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, onlyRecordCount: true, sort: null });
  public static readonly DB_MAX_PING_TIME_MILLIS = 3000;

  public static readonly EXPORT_PDF_PAGE_SIZE = 100;
  public static readonly EXPORT_PAGE_SIZE = 1000;
  public static readonly EXPORT_RECORD_MAX_COUNT = 100000;
  public static readonly IMPORT_PAGE_SIZE = 1000;
  public static readonly IMPORT_BATCH_INSERT_SIZE = 250;
  public static readonly BATCH_PAGE_SIZE = 1000;

  public static readonly SFDP_LATTITUDE = 43.585784;
  public static readonly SFDP_LONGITUDE = 7.0377592;

  public static readonly LOCK_WAIT_MILLIS = 1000;

  public static readonly SMART_CHARGING_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_CONNECTION_LOCK_SECS = 5;
  public static readonly TENANT_DEFAULT_LOGO_CONTENT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAA7EAAAOxAGVKw4bAAADmmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDIyLTA5LTAyPC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkV4dElkPjcyNzBhYWI0LTg5N2YtNDgzMS05ZWNiLThkYzc2YTgxNjYxMzwvQXR0cmliOkV4dElkPgogICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6cGRmPSdodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvJz4KICA8cGRmOkF1dGhvcj5NaWNoZWwgU2FwPC9wZGY6QXV0aG9yPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczp4bXA9J2h0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8nPgogIDx4bXA6Q3JlYXRvclRvb2w+Q2FudmE8L3htcDpDcmVhdG9yVG9vbD4KIDwvcmRmOkRlc2NyaXB0aW9uPgo8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8P3hwYWNrZXQgZW5kPSdyJz8+Edm9uwAAH8lJREFUeJy1m3m4XWV97z+/3/uuPZwxJzkZCSFzSIBAgDAqWAWtioq9VatV9JaW9mmf1rG9TvcRe5/WXr3iVK23cttq1d5qfbReBYvaXikVBTQJJAxJCIGY8SQnJznDHtZ639/9411rnxPQlg5351nZZ09rr+/3Nw9b+HfcVl95KzMDw2w5/UMe0U1ozTm8DzmKeaE+5Oi23NmauQtU/SbxepY6tyE4t7rwfn70bsScs+jdhDo/Lt7vc9495rw7mHn3sDr3UH1e/4GiHTGn9A8b7W7DhcyF81ccZtu2JdQXGDt/7bx/Mwb5t3xo1WXvxmd9aIzEWGDOuzwQXMMRvadA1+PkJeLdC0XdNepdvziHeoc6R3CO3Kf3mnOYd4jzaOZw3uO8I3MO9X5KvPse3t+F6J2Nft2TW41uLaMhOFMJSgcJ0JZBHrl55f9fApaf91aaA0MEIqHVotboc6qEoJ480JC6e5U590Zz+tzotCbqEKeIc6beBXXexDmNmZPceYneEZ0D7xDvzXlnmmUx8068c069E5xDvAfvujh3N959Lmb1L9eUdsBwNedaw8OhPt1BY85kFtn36jX/8QSs3fxerCnpA8HESyZBQhRPPeBuRvUtUXVddIqpYk4LnEecOnFJ8uIdzjmKzFM4R/BezDtw3qQnfY/3Du8d6jziXTDvEO+8OEcixO1Rpx/tBv5Xrek7omjwNVOiIUIRYdcvnfOscOmzedO6C99D6Ai1hSBFdGZiZiGa2UstyDYxPomxDqwQs4BhGM4wj6Vz2CzhAoiV5Jf/CYggIggikh6agAleRBwiZiIBlUKEdcAnazW3LaIvNnFRVMycutDx+Jqw+StP/UcQcCvrL3wXguGyQDxSOCIhxjgasC8KfEPMNopZARYxHIYihgmAmWFiVkLpIbbZrxDB0h2CJQ4SCSUhYkjJm6CIOBGJqBQIG1Xsjqh8PmKjJhJcP85wIMpFXz0It9ozUD07AjbdyvotLZBIJEpt2ItECxjXZ8oOhdcKBNLhKS+ThE8wS2J82s0As5IOoQe+ImMOS5SakIhQEVTnPudRCSZEgV9Wsx1mXG9IqKmJqoiocMklh9n0pV3/egI2+C4SFUxk78ndFjvBzORdKnYXsAwsLz/vSkhgJsgcv2I2B86cm8z5Yw54ethKcoSeKTzNSDARM8GVH8hNWKbCXUJ8J4rNZINWnaqvOdK7lmdFwIaL3p3sD5PD42N20YLNxCLeJvCHCIZJADJLqlyduVTuZ35RBYA5UjekMooSnFFiK8HLGeCrx+VzUj5nlh5niAQRMVX5QDS9bdimaReZGQhibL3z0LMjYMPmdybLNZPdOx6ylSvOYobup0X0rSAhATaXcCU2ZsGXrz4d9Fwyeupvc8hJb5TeZ6SnEWc+Fmz2EEQk/a0mIq7kNojyVjP7n4P9xp6dO5MfEtj6rYP/PAEbLnwncbLAikCjv8GmLRfTnc4/pMivKxbAFFCkp1A94FZSYdWzFRHV40o/RDDkmeT0PEb1mp0h9VlTYS4JoKXjSKdVERSsQLglFsWHNm3eTANHANqqbL3jzOjQI2DV+e/CnOIvGEAb3uXdtoVY/J6IvEOwYKAmIlaJridD6al07wIryc6VainIKh4kEqwHXOYArN4sPenPaoLNeTxLePmkYiUdTiAg9o6o4R1Bg9UxN9/aOCds/eYTzySg1lAQIf6k44gWLNp1ovx3KeVWXqqVAGcd/lzb7tnqHFBnODnBepKdBSWaROed4DQ9H4FYeRQRnAqqs98Te1pQnb4MvMktCBqljKAfisILTAhty5wIZJk7k4CVW95DIRGqDCfaQkQ/ayJEIZioWvJSs2I9A3h5MVTSr9z206U5x/5LUxABVYhmnO4UnO4UFGY4FTKniBidEDjVCUwVkQCops/13G2Zd/ToEDMDBQtCRNT+IhijhoQYkSJ6LrsraYEH6HeO6SKnRibR1HB8HFgGkgNZqeVJ8nPC1Rm2KGCqoOkyREsC9EzwEempvzohmDHdKVgyUufSVQu4bNUCNiweZH5/De+EdhE5Mp3z2HibbWNtHj1dMN6Fel3wvYRrVhtFTJKfFUPMIeTAcq/2cVFeh0XJi5p5bSeu1mx9FzXzRDOHESJ2g4r8H1KCU5qIgYhUDm0u4KhCFCGm/J/oFHOpCNKUw6PO4Xyq+nLnCd4hmWfGhJHBJjc9ZzWvu3wl6xYPzLGZZ946ecHek23+9vEJvnagxZGgDNQdTumZkSZLRhXTMrwCUQUn8DKwbwDOrB3MPLLp8g9R5BPEKEh0Da2FbcC5JQHOqmSt57iSSkdNko+awEeVqggCp7jMI84RVUAUdUrMPFbLkJrndAGXrF3IB159CZetHk00m1FEw6miP5sHwNhzfJqP7jzOnUdzGnVPpgJJASkVERFMU7QOIuYEHsYVFxN9BwPxx3Ab37KN6Ycvd6oYLt4iIm9EpEDwPW2t0jNNKm0664Aq0FZSLqX0W3mgGyN9zRojQ00G+uu4mqdrxolWznUXLucvfv25rF8yTIiW4qqAV6UoCu4/MM7XHz3GHXvGuecnp9kz0SYA8+uOzCkL+mq85OwBhsi593iL4BQvlkxLrCwhrKwvTBErsLgY08OI3Y9Et/azF5qsufQ9BCIi0peJe1CMNSRTrWJ8GZ4T8Fg5OX2a9EUQ7+iaEREuO385N157LhesWczovD6yzNHqFhwan2LXwQlevnUVK0YHKULEleIS4J49h/nE959ix/E201YS6j2WOYaaNTaMNnnN+gW8cvU8Mpcs9G8ePcytD08gtQwvPRNIRIAlQrAyj9kbiBciMiMmyLmXv8+BBTO7CZHPAgVQxQmZjeuzDk9csvtACkd4h3plJg+Mjgzwnpuv4Reet4lmI/vn9JhoZwaW2+9+hA/+45PM4Olr1vBZ0ibzqWlSiNJKasLzlg/x+5csYdVQA4DbH3yKDz0+SV89A2zWFAARKzM4CwjehDeK8TnAuaWrrzdBicJHEFaVulMVHNV9T+rihKlOQSsPuCy1uboxcmomZ/mSYW5/7yt4ydUbyLwjhMD2PYe560f7ueeRQ+w9eppa5hgdbJY2n4hQFT7//Uf5r3+3G8lqNOvVlZcmJ0JQwRS8F5wTdp1uc8/YNJcs6GNxM+OiBX3sPHaSx1qBPg9CLC02ohhIxCQCpoYN+z75XNbEZP0Vt4JwPiLbqxy/kn71h0ll9zDVyrl8y0recOPFrFu1EDM4fPw0f//APq6/Yj0vunIdANse/Qkf/tIPeeDx45xsFxROIctYML+f6y9awbtediHL5w8AcN+eg9z0hftpuxq1zKUo4lMUoYwssewdRieYU9Qr09HYMNzgs1evZNVQkwePnOCW+56i4zNqZRuhl12LGVIl7BQgF4HtcvNXPh9EbkLkRSgFIgqCaSV9xVySfruI/PYbr+H9b34hI/P6AGHN2Qs4b80SXnjletYsn4+IcO+Offzah+9g+/5xxDlqjQxXz9CaY7qI/PDJ49y//wTP37SU4brjbX9zH4+e7NJXd8QqkXUpQxSF4FLRb1oeYkSBPg9H210OtnJefNY8zhrq5+D4BDtOt+nLFLNYJl1WSj8CFpDoIe4X4ftu8ZrrCWbvQ2RNqf5qSfXEREu1d0y1cl7z0os4f/0i3vXxu/jE//4BX/jWQ/z1tx/i/kcOsnjBAMsXDTM1PcNvfPib7Ds6zfBQg1Cqb3DJYTqvDPTV2HN8ipk8kHfbfPre/TQbtZ5/qQ5N7YgzwauV4S4iQL8XHp+cYXHDs3n+AMvqjr8/dIK2CkJJAFb+HQXMkKhmFrxvfMENLrtmIU7/Byq1yulV4FNHQemEwNlnjXDZBcv4gz/7R34yNoU6RzRjYqbLQ/uOcccP9jI6r589Tx3l8999lP7+BjmU6ls1SqUXRpt1z5Pj0/zo4DjTMdm3OEF9+b2afEMFHIXYA2+oGk7Aq6EYh2ba/PzyBSwfHuDHR46xa6rFQKZECyARxASiISZiUVBb2A357W5kzXVXIfKrs80FkdizeQUndIrIpjUL2bXvKIdPthkYqCe7cg6fOfqadboh8o8PHmDHvjG6Rum9y+xQhViptRNUJSVGKhxv5USBRs1TYLSjkdW0JCCB7xDpEstiKcV5p4aTdNQcjHU6nD9vgHXD/SxteLaPjTMWCmqOZAo9Deg5wwYSvuuGV19/IyIvQiT01F9UbE4uHxHmz6tz5GSLPKYgYaop/XSaQqIZ7TwwPtWhAFrBaEWjC2jmcZlL5qQpK3RO6Vpk/ZJhfv8lW/idazZww7lLCEWXR06kaCECMzEwOthgWX/GqU4nRYJSC5wYohEVIxA52e1y1cJ5rB0Z5urRQXaMHedgt0vdCUYAMStrzABBxeION7z6+l9A5SogIGhSf6kSaUwEVWWmU9AuDBNNeX4JopUHUOG81Yt48RVrednV63nR1tVcff7ZbFg+Qr3mODrVYjIP1GoO5yUVQcDIQIM/fe1VXLdhGYsGGqwYGeDn1y1h56Fj7D3VwhReee5ZfPwFF3DTpuVsGKhx/5HjdEgagMSU60vEOzgwPcPdR4+zZrCP80fnc/nIIN8/coSxUODViMQyDsRomDOxB72JrC3ze50tL2fvjWSPM3lM6YFLUjdgJg9cvXkFN9+whasvWM68Mr7PvbU6XbbvP8YX793N32x7km6E/ppjKg+8Yt1iLlkxShEjKkKIRuYzXnHuWdx14ARLR5r87uXrWDbYB8AvbFzJ7hPj/PHewwz67Iymkhk0nLB/apK3P7CDP7z4fK5dsoi3rl/F2x/aRaG+LKGtLGoMjFWK6moTTWFPpaemlEcabSnqUkxWp6lZIcLbX3sVX3jfK3npVet+KniAZr3GlRuW84k3PZ9P/fJVLB+q07WIOrhs5cKUCInQzQuszIzOHhlAyFk1r8nSgQbRjDxEAC5cNEJGUSpsgRB6R7SChjMmui3eu30He05P8vxV53DlvAGmijZYgVmBWa5GgRFWe5QlKVnQOYlPGQ7mdm3KGr8qiW/9lWu5+YYtPaB5nnP/7sNsf/I4xyY7DPTV2LR8PtecexbNusep8vItq/nsvY/yxIEJFg03ufTsBT0C/uGxJ1m7ZJR1C+exuL/JkIdzhvsRUcysl/cv6mvQdEa0Ys7UIUU3A3KDuhMOtSb540cf5mOXXc7zR0f59omjRC+YRUxSXgSyyIvqUO80IlVq/rRWVrpXJ8x0C972miu4+YYthJg6N3fveIJPfmMb9+49xqk8gFNO5zkv3rKSK9cvZUAVi4G3/fXd/NOBkzgnbFwyzIbF80rGI3c8doBfHOhn3cJ5zO9vsHqkj7Uj/QBMtTscmDjFeUsXs6ivyaAzJijOUP9eH9KMPApNB987doh9U5NcvWwZg7sfoms5igmzxeewohKlVP1eB2dOUV39rV6Z6Qa2blzG7/ziVgCcCn/93R288SN3cteuQ+SqDA028DXH1rVL+MRN1zDSn4qV2+68n8//eD/1RkZhka3nLKTmU811ZGKS7//kKEemWqXZ1Nm8eIT18wfT65NT/O3u1MIaadZZWFNCTGYQLRAJRAqMPKl4aSIzRYenpidZ0NdHnxjRcsSS6WhpPoro6dSYVETVKsApDXUJvEsRIcsct7z8Yhr1VOXdvf1x3vm5f6JlykB/HfHKTBFYMNzkk2+6ljWL54EZH73zPt79zW1o5kEi9Zpj64qFPfN5+Og4+05Pc3Rqpqd1Vy1fzNp5iYCxmRkePn2awoyBRoMVA03y0MGkBG45RkGay6bHlEeIIcmVgJCj5CYUJgTEinEV1WPiqsCqPfDJASZinHPkIbLhnFGuuXAFAN1ul9u++gCnCshqnkKETjR85rjtl5/D1tWLMeDk1AyTufGW6y7i3EUDTHZzzlkwwOZl83sE7Dg8RssiR6enk0oDz1l9NvP7kvYcnpziwNQkM90cRDhnsJ8Yu6TKPZ8DuigdYzrqEplfr9MJBcFynIWkAVakg+KEorKPOdLX0vtrdZRhrxOM81YvZHggXdS2vYf58VMnqTdrFAJBoF53fOwNz+WGLasAiDEyMtjPf3355Vy3bhGtIifHuHTFKEuH+tMYpyh44NAYmRMOT071jHq4r0nmkok8MTHBsfYMJ9rJRFYND+EleX16Kl8g5IjlOCsIocPSZp2Nwwt4eOwop0MLN0uUYQVQ7Fec7C1tPUpp96pVJTbbXQwqrFgyrye17fuOMdENiE+5ficazz33LM5bPp9tT45x8OQUrmxv/dE3f8Drv/A99k92qGfK1SuX9HztkycmePj4SfprjkOTk0x1uohIapaIQIzsmRhnsmhzYPI0AMuHBmmoESxPwK2y6Rwl4DTQCi1uXLGGhnPcdXAvM5YjhIqsmLSm2Kcqeri0/9T6U7EqD6jaXVEVyRxDA/UeAcdOzxDKpqeJUK877t13lJ/74Nd5/e3fYbqTM356ips/+23+4B92oplHFJYO93HVysW98zx45DhHW22amXBkepoDpydLJUjdorGpKR6bGKcgZ//pCaDs5Us4Q92VAkdEJXCyM8XmkVFuXr+Fp8aP83fHHqeRKdFyK+O/pPvioEfkQU1hzlVjhShzW2CAKjnKdLfoXXi9nqV0WRWIOJdeb9Q9n37DtRRFl5f9ybd58Ngkg/11RKGd5zx39RJWLxjuhdAfHDhMKAua8XaLveMTbFy4gGiGAw5NTTLWadFQ+MYTuzlroI8vPryDtuX04crZURqe5ATMIhcuWMKnrrwBCZF3P/AtjoYp+n0NMyvnKeIEMOQhb8IOU50ysQFDrJy7Sw+8CDglqLD/+FSPgDVL5pH5ZB4qSmFGlnlue/UVHD91mjf8xX2cKiJD/fWy6Qq1TLlhY9rdcSocGp/g7icPUvPpcrox58GxY7xswxqCGRnw1MQEM7FDXz1j27FD3Pz3B1CFhtfkA8QwM1YMDHL2wDBXLFrBr27YyrHJU7zpni/ywOQRBmq1FAIhzc3SSGrSQrHDM9QYK2byHyLyApAY09LBGSREEXzN89DBk0y3c/obGZesWcKSeQ1OdAyvaa73m9eey54jJ7jte4/gap6+uqOwiPNCKxRcevYoz1uzLKm3CHc+to/HJ6cYbNYIEsi8ctcT+7lp83mcPTTEdKvFl3fvwiQiFHgX8SmmlbZsKNCOXX7t3J/jNWsughj5+uM7+PCu/8uRYpqBrEaM3bIrLCJIAHEY9zqaYz60A6b6LYQXpB2PspdcmUBqq1JrZOw8NMEDT4xx7cZlrFwywkvOX8Znfvgk/T7jwuXzeOjgGN/afYy+vhqqUJihZZ86t8gbLl7PYL0GwInTk3zxocfKQWUkEql54fFTJ7n5zju4buUKHjh0gPvGDtFXS9I26U0fMWJPG7GcZhkx/ss9X+FLB3fQX6vT710CX/WepZzzpoT3O6JT+FwFjG+p8keGeEuThNn1lDJDdE441c750+89xrUblwHCW198MffsP8Huk232HJ9iKi8Y7K+ntpUYXpWcyEy3w3/euoFfunAt0QwV4fb7d7BzfIKhZkaQWI7OI3UnPDJ+jB3HD1L3Ql9NwUIJvpoXR8BwInRCh8WNPraMLufU9BQ/GHucZk2pSSTEkCZMQjWvB8QLEqJwhwFa7x8kazR3BnV3lx4/lmMuq6Y9pimPGuir83c7D/Ll+/cBsGLxCH/y+qvZuKifsZkuQYRujHRjZCZETnW7DNQ9733Bxdx2w5VkTlERvvvoXm7f/gjNuk8VuhjToUtBQNTo88pIo0Z/lsCnllbaxxJCaolJoFVMk4nxlguex9kDI9y1/0GOdifIBIoyRKbqr6i8fzQCZsX3nIRd4gOucdENLlQjCic3mmgUFS1LY6nyACkToyBw3/7jXLZqlLNG+lk2f4gXbjqLTI1WEVAnDDZrrB4d4pUXnMMf/Pyl/OLmNWmRQ4QdBw7x5m/dzck8p5YpwSI1r1yyZCHTeYfxzgyFFWWYi6gaqCESMQIFOa3QJlrOpvmLufXSl3Lj6i0cPjXO+370FU7aDF6kJCvONk1SgzQKpkZ8v5ntIEQno7d8LjklpU+QB0HWIJJGY9VcsBw8IuA0NUmXjTT5yKsv57qNy3qmeHqmw6lOjoow1Mx69l7d7nrkcd793e9zqN1moKYUBE7lHX576xZufe7V7Dp2lO/s38cPjjzFk5PjTHRnaMUOBTmIUffKSLPOxpHF3Lh6My9fdRFeHbuOPcWt93+F7aefopllpOEc1YqCpSJXDEQReTyabhbCTHrL+97BoqNbHEKIZr8pwifTcFS8SJoxSbW+VY6enUuq3swcN125hpsuX8u6RUP89JvxxPEJ/uyBXfzlQ7vJJVJz0ApdcPDGzZv4b897DjXnZz8RI8dmpjk4NcFYa4pWyKk5x8K+AVYNLWC0OYDFyLZjT/K3T9zPHQe2czJM0/S+B77cOiu3eEREpADxiPwWyKcAt/urHwqy6Ve+xNF6jkXQoA2p23aEDSISEJykyWIiUemt4zgHAWOmCCyZ12DrOaNcuXKUtaODDNQzOkXB/pOnuffAEf7pwBGOzMzQX1NqDpo1Zf3oMG+68HxetmEtAN2iIJgRLCmfU0ljcoRuKJjK24zNTPLYycP86NgT/PjEE+yfOsZUaNGXeTJVzEJvGaPy5eUFBxFxmDzSNdsiEjsOwfu1yLxb/pzMNcDjMAlm8WXq9OsiBERUpKf+ImVIlNIcpOzXd2OkFQrEGc1M8V6IRNqxIBLpqyl1DyqBvkw5e14/q+cP01dznGjP0A45eezStVS1FWWBEwkEAp3YpV20mC5atGKbgoKaF+pOSGqaHGUK9Vb1b6yyA0mOwGG8nLT84WKWBSnKALn4N/6Kbr/SDGjEYkS+qCKvTeWVZKJz9gRKM6hGVJVvUJfMLJZdWlFwaqRWa0huRZKX71pBK3YJBLwzVCNOYxpkakQ0oJXnl4hqSIMQjeUGSCxBp6iQQFcd4lL1pVQEIRckM5G/AnmdiVPJT0WaS3joFR9MdUU35PiiQVAMUbDwZlSfJ8JSRAKKq3YSEaQ3uRWhWlCKzFl5U0HUeomLpOEklO/LnJBltUSOhvIrSilqKN8/d0U2LacKRrRYEhoQK718mReUnd5qk09IVXpmyGEzebNiiAUT6oSZVForwMnP3ESVYYri1LkxE25K6p62s0WrLZEyk+q10aqyebaJKnPu54K30mwSYTG1siymY+4/S68ZMTUxy/tINeCsAJevl6RANAiYBYEQjejKqdBNQhgDcyJquIydr/3ELAEAraKFEKl1O0GcOPX6HZz+booC5a6JpmhQrVxIuTJTgZfyuTP5sTLLo5wznPl30hDrSVqqx1W6m0YZZzwnc4gQSVqQCuhImhunXd+0wR9/V7HvCLih+vxgQMf12sm9TRC693+N+hWvouPqOFXzTkVUvw8MierVKQXTtLEvPdBSrcEl1bdKKZJ6l3s6VtmmlNPacqqT9nliSVICI9qb482Ck950t/d88gPpPCqWmuKSyl0Rq1b4Pywxu9XFmnSZjie6p8jwPPKqT/cIOGNX+PhHX0PNJRsuzDhIm0bTv93EPoOKLz1NpFzbR2V2J3J2M2s2SlRSFsoN0cp39Hb6yrpkdqkpNazP3Dg37GmFkJUVZVpfTPMUE4NYit0b8TONzN7x1JGDdGQaxTHg6ux6zWfOOPcztsWPfOg/lWostlQacuJETs1nt5jKR1BxpRkE6y0pi5U7uk+z+xJszxnSy86sLGOlhIPMAd0jae7z1Yw/HdWafsVpTN8Q0iIuLph9TDW75eDEFGctHS21Ana9+s+fDven/17g0B/uSG1yEesbVNnf7eDRt5nwbkQk/VDB8jI7lN5OXgW8J7k5+zal1Hu/I+kBnMU8V8I87ZhLlFR6YiZl8Mkt/VxHBHt33fm3PH7sJPP6+oXyFzs7X/XZnwb1Z/1i5FYOTTxZeTNbmjkRcWIiH4jIixAOIZKJWCw3r6qZUimmai1lNjT2Hs+hxaq3Czxd7WcpnEON9TwhIiZRCJa8YQYcDDG+ENwHvDZkxfx+oZS8uOnqNM+4uZ/+NHDfnUz+3AYGdSkARSzQzDkR9gbRv1Sx5aJsltRELkTKnTJlTkJU+nyNPQ+fKrtedZYsqHKOMscBavn+tNXRiwJlxmeS1uE9aZ/li4XajSqyU0VdqzsZKzt89LHPMfZbD/9MmD+DlzNvy97/NfJ2oP/8YfL9My5CUI1Exw1e7IMitlEk4sQKE5MoQROgIFGiiUQRiYZEsTLDE6lq+4jT0Mvs0q9xgqlGgWBQlOcIQEjL6xK9pLW3R4zwe2LxG+IMTJw21oYw/SPE9fPY6z7/L2J7VgQALHr/16g1FYtGjIh3UaJIdEHqVit+1Yu9GYnrrNrIklhYWkdxWqbBpkYsszgkoBLFSUCkTGDKpgcSEE19QIghpvd4LEBKk/dA+FiH/Pa6SEfN1DRaqTZY3mX3G/5l8P8qAgCGbruToU6HolDaMaO/r+MkSHBZAF80xXg1Ym8widcYMaukrUkLQpRoRlSRIKJBtNQAkQgEMwmGhJiKt+iEkJLnRFgXC3ebxr8UwpechHaXgkxw6jrBRUc0x2QGP3n1nz1rTP8qAqrbkj/6Ks1axAyKoDhnzlwIHkMyJQ/FBiO8GInXo/E5KmGoWk6yqigioIkctCxuSqCzRRDhlBHuMeJ3ooY7Gs52FxYI5GREV0gRHB4RoR27PPn6Zw/830VAdTvrw19mYcPYvm+MFcsX4yU6V3ehk+eYhNQZDvlC7+OlEC+IEpYhth6JK50UC5QwLzWfwoRpHEfiE0ax2yQcUokPYuGBRkOPd7odggQGPLRD4Yw8tHQ+87s5M26Kx2/61L8Zw/8Dr8SpQms6h2sAAAAASUVORK5CYII=';
  public static readonly HEALTH_CHECK_ROUTE = '/health-check';

  public static readonly DEFAULT_TENANT_ID = 'default';
  public static readonly DEFAULT_TENANT_OBJECT = Object.freeze({
    id: Constants.DEFAULT_TENANT_ID,
    name: Constants.DEFAULT_TENANT_ID,
    subdomain: Constants.DEFAULT_TENANT_ID
  } as Tenant);

  // Output of crypto.getCiphers()
  public static readonly CRYPTO_SUPPORTED_ALGORITHM = Object.freeze([
    'aes-128-cbc',
    'aes-128-cbc-hmac-sha1',
    'aes-128-cbc-hmac-sha256',
    'aes-128-ccm',
    'aes-128-cfb',
    'aes-128-cfb1',
    'aes-128-cfb8',
    'aes-128-ctr',
    'aes-128-ecb',
    'aes-128-gcm',
    'aes-128-ocb',
    'aes-128-ofb',
    'aes-128-xts',
    'aes-192-cbc',
    'aes-192-ccm',
    'aes-192-cfb',
    'aes-192-cfb1',
    'aes-192-cfb8',
    'aes-192-ctr',
    'aes-192-ecb',
    'aes-192-gcm',
    'aes-192-ocb',
    'aes-192-ofb',
    'aes-256-cbc',
    'aes-256-cbc-hmac-sha1',
    'aes-256-cbc-hmac-sha256',
    'aes-256-ccm',
    'aes-256-cfb',
    'aes-256-cfb1',
    'aes-256-cfb8',
    'aes-256-ctr',
    'aes-256-ecb',
    'aes-256-gcm',
    'aes-256-ocb',
    'aes-256-ofb',
    'aes-256-xts',
    'aes128',
    'aes128-wrap',
    'aes192',
    'aes192-wrap',
    'aes256',
    'aes256-wrap',
    'aria-128-cbc',
    'aria-128-ccm',
    'aria-128-cfb',
    'aria-128-cfb1',
    'aria-128-cfb8',
    'aria-128-ctr',
    'aria-128-ecb',
    'aria-128-gcm',
    'aria-128-ofb',
    'aria-192-cbc',
    'aria-192-ccm',
    'aria-192-cfb',
    'aria-192-cfb1',
    'aria-192-cfb8',
    'aria-192-ctr',
    'aria-192-ecb',
    'aria-192-gcm',
    'aria-192-ofb',
    'aria-256-cbc',
    'aria-256-ccm',
    'aria-256-cfb',
    'aria-256-cfb1',
    'aria-256-cfb8',
    'aria-256-ctr',
    'aria-256-ecb',
    'aria-256-gcm',
    'aria-256-ofb',
    'aria128',
    'aria192',
    'aria256',
    'bf',
    'bf-cbc',
    'bf-cfb',
    'bf-ecb',
    'bf-ofb',
    'blowfish',
    'camellia-128-cbc',
    'camellia-128-cfb',
    'camellia-128-cfb1',
    'camellia-128-cfb8',
    'camellia-128-ctr',
    'camellia-128-ecb',
    'camellia-128-ofb',
    'camellia-192-cbc',
    'camellia-192-cfb',
    'camellia-192-cfb1',
    'camellia-192-cfb8',
    'camellia-192-ctr',
    'camellia-192-ecb',
    'camellia-192-ofb',
    'camellia-256-cbc',
    'camellia-256-cfb',
    'camellia-256-cfb1',
    'camellia-256-cfb8',
    'camellia-256-ctr',
    'camellia-256-ecb',
    'camellia-256-ofb',
    'camellia128',
    'camellia192',
    'camellia256',
    'cast',
    'cast-cbc',
    'cast5-cbc',
    'cast5-cfb',
    'cast5-ecb',
    'cast5-ofb',
    'chacha20',
    'chacha20-poly1305',
    'des',
    'des-cbc',
    'des-cfb',
    'des-cfb1',
    'des-cfb8',
    'des-ecb',
    'des-ede',
    'des-ede-cbc',
    'des-ede-cfb',
    'des-ede-ecb',
    'des-ede-ofb',
    'des-ede3',
    'des-ede3-cbc',
    'des-ede3-cfb',
    'des-ede3-cfb1',
    'des-ede3-cfb8',
    'des-ede3-ecb',
    'des-ede3-ofb',
    'des-ofb',
    'des3',
    'des3-wrap',
    'desx',
    'desx-cbc',
    'id-aes128-CCM',
    'id-aes128-GCM',
    'id-aes128-wrap',
    'id-aes128-wrap-pad',
    'id-aes192-CCM',
    'id-aes192-GCM',
    'id-aes192-wrap',
    'id-aes192-wrap-pad',
    'id-aes256-CCM',
    'id-aes256-GCM',
    'id-aes256-wrap',
    'id-aes256-wrap-pad',
    'id-smime-alg-CMS3DESwrap',
    'idea',
    'idea-cbc',
    'idea-cfb',
    'idea-ecb',
    'idea-ofb',
    'rc2',
    'rc2-128',
    'rc2-40',
    'rc2-40-cbc',
    'rc2-64',
    'rc2-64-cbc',
    'rc2-cbc',
    'rc2-cfb',
    'rc2-ecb',
    'rc2-ofb',
    'rc4',
    'rc4-40',
    'rc4-hmac-md5',
    'seed',
    'seed-cbc',
    'seed-cfb',
    'seed-ecb',
    'seed-ofb',
    'sm4',
    'sm4-cbc',
    'sm4-cfb',
    'sm4-ctr',
    'sm4-ecb',
    'sm4-ofb'
  ]);

  public static readonly UNKNOWN_OBJECT_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_STRING_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_NUMBER_ID: number = -1;

  public static readonly REST_RESPONSE_SUCCESS = Object.freeze({ status: 'Success' });

  public static readonly REST_CHARGING_STATION_COMMAND_RESPONSE_SUCCESS = Object.freeze({ status: 'Accepted' });

  public static readonly DELAY_SMART_CHARGING_EXECUTION_MILLIS = 3000;
  public static readonly DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS = 10000;

  public static readonly CHARGING_STATION_CONFIGURATION = 'Configuration';

  public static readonly OCPI_SEPARATOR = '*';
  public static readonly OCPI_RECORDS_LIMIT = 25;
  public static readonly OCPI_MAX_PARALLEL_REQUESTS = 2;

  public static readonly ROAMING_AUTHORIZATION_TIMEOUT_MINS = 2;


  public static readonly MODULE_AXIOS = 'Axios';
  public static readonly MODULE_JSON_OCPP_SERVER_16 = 'OcppJ-16';
  public static readonly MODULE_SOAP_OCPP_SERVER_12 = 'OcppS-12';
  public static readonly MODULE_SOAP_OCPP_SERVER_15 = 'OcppS-15';
  public static readonly MODULE_SOAP_OCPP_SERVER_16 = 'OcppS-16';

  public static readonly OICP_PROGRESS_NOTIFICATION_MAX_INTERVAL = 300; // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
  public static readonly OICP_VIRTUAL_USER_EMAIL = 'virtual@oicp.com';

  public static readonly WITH_CHARGING_STATIONS = true; // Not used
  public static readonly WITHOUT_CHARGING_STATIONS = false; // Not used
  public static readonly WITH_SITE = true; // Not used
  public static readonly WITHOUT_SITE = false; // Not used

  // Password constants
  public static readonly PWD_MIN_LENGTH = 15;
  public static readonly PWD_MAX_LENGTH = 20;
  public static readonly PWD_UPPERCASE_MIN_COUNT = 1;
  public static readonly PWD_LOWERCASE_MIN_COUNT = 1;
  public static readonly PWD_NUMBER_MIN_COUNT = 1;
  public static readonly PWD_SPECIAL_MIN_COUNT = 1;

  public static readonly PWD_UPPERCASE_RE = /([A-Z])/g; // Cannot store regex in enum
  public static readonly PWD_LOWERCASE_RE = /([a-z])/g; // Cannot store regex in enum
  public static readonly PWD_NUMBER_RE = /([\d])/g; // Cannot store regex in enum
  public static readonly PWD_SPECIAL_CHAR_RE = /([!#$%^&*.?-])/g; // Cannot store regex in enum

  public static readonly SUPPORTED_LOCALES = Object.freeze(['en_US', 'fr_FR', 'es_ES', 'de_DE', 'pt_PT', 'it_IT', 'cs_CZ', 'en_AU']);
  public static readonly SUPPORTED_LANGUAGES = Object.freeze(['en', 'fr', 'es', 'de', 'pt', 'it', 'cs']);
  public static readonly DEFAULT_LOCALE = 'en_US';
  public static readonly DEFAULT_LANGUAGE = 'en';

  public static readonly ANONYMIZED_VALUE = '####';

  public static readonly WS_MAX_NBR_OF_FAILED_PINGS = 3;
  public static readonly WS_LOCK_TIME_OUT_MILLIS = 500;
  public static readonly WS_DEFAULT_KEEP_ALIVE_MILLIS = 180 * 1000;
  public static readonly WS_RECONNECT_DISABLED = 0;
  public static readonly WS_RECONNECT_UNLIMITED = -1;
  public static readonly WS_DEFAULT_RECONNECT_MAX_RETRIES = -1;
  public static readonly WS_DEFAULT_RECONNECT_TIMEOUT = 30; // Seconds
  public static readonly WS_CONNECTION_URL_RE = new RegExp(['^(?:(?:ws|wss)://)(?:\\S+)\\/(?:\\S+)\\/',
    '(?:[0-9a-f]{24})\\/',
    '([0-9a-f]{24})\\/',
    '(?:\\S+)$'].join(''), 'ig');

  public static readonly OCPP_SOCKET_TIMEOUT_MILLIS = 10 * 1000;
  public static readonly OCPP_HEARTBEAT_KEYS = Object.freeze(['HeartbeatInterval', 'HeartBeatInterval']);

  public static readonly MAX_DATE = new Date('9999-12-31Z23:59:59:999');
  public static readonly MIN_DATE = new Date('1970-01-01Z00:00:00:000');

  public static readonly REGEX_VALIDATION_LATITUDE = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)$/;
  public static readonly REGEX_VALIDATION_LONGITUDE = /^[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  public static readonly REGEX_URL_PATTERN = /^(?:https?|wss?):\/\/((?:[\w-]+)(?:\.[\w-]+)*)(?:[\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
  public static readonly MAX_GPS_DISTANCE_METERS = 40000000; // Earth

  public static readonly CSV_CHARACTERS_TO_ESCAPE = /^[+\-@=].*$/;
  public static readonly CSV_ESCAPING_CHARACTER = '\'';

  public static readonly EXCEPTION_JSON_KEYS_IN_SENSITIVE_DATA = Object.freeze([
    'error', 'stack'
  ]);

  public static readonly SENSITIVE_DATA = Object.freeze([
    'firstName', 'name', 'repeatPassword', 'password', 'plainPassword', 'captcha', 'email'
  ]);

  public static readonly DEFAULT_OCPP_16_CONFIGURATION: OcppParameter[] = Object.freeze([
    { 'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null },
    { 'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null },
    { 'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null },
    { 'key': 'BlinkRepeat', 'readonly': false, 'value': null },
    { 'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null },
    { 'key': 'ConnectionTimeOut', 'readonly': false, 'value': null },
    { 'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null },
    { 'key': 'HeartbeatInterval', 'readonly': false, 'value': null },
    { 'key': 'LightIntensity', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null },
    { 'key': 'LocalPreAuthorize', 'readonly': false, 'value': null },
    { 'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null },
    { 'key': 'MinimumStatusDuration', 'readonly': false, 'value': null },
    { 'key': 'NumberOfConnectors', 'readonly': false, 'value': null },
    { 'key': 'ResetRetries', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null },
    { 'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'WebSocketPingInterval', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null },
    { 'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null },
    { 'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null },
    { 'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null }
  ]) as OcppParameter[];

  public static readonly OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.WATT_HOUR,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
    location: OCPPLocation.OUTLET,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_SOC_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.PERCENT,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.STATE_OF_CHARGE,
    location: OCPPLocation.EV,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_START_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_BEGIN,
  });

  public static readonly OCPP_STOP_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_END,
  });

  public static readonly OCPP_VOLTAGE_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.VOLTAGE,
    unit: OCPPUnitOfMeasure.VOLT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_VOLTAGE_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_VOLTAGE_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_VOLTAGE_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_CURRENT_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.CURRENT_IMPORT,
    unit: OCPPUnitOfMeasure.AMP,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_CURRENT_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_CURRENT_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_CURRENT_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.POWER_ACTIVE_IMPORT,
    unit: OCPPUnitOfMeasure.WATT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly AFIREV_MINIMAL_DURATION_THRESHOLD = 120; // Minimal duration - 2 minutes
  public static readonly AFIREV_MINIMAL_CONSUMPTION_THRESHOLD = 500; // Minimal consumption - 0.5 kW.h
}
