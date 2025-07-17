import { LogLevel } from "@/core/gameConfig";

const LogConfig = {
  debug: {
    level: 1,
    color: "#999999",
  },
  info: {
    level: 2,
    color: "#35b1f0",
  },
  warn: {
    level: 3,
    color: "#f0b835",
  },
  success: {
    level: 3,
    color: "#35f06d",
  },
  error: {
    level: 4,
    color: "#f03535",
  },
};
// 输出带字体颜色
function printWithTextColor(text: string, color: string) {
  const logArgs = [
    `%c ${text} %c`,
    `border:1px solid ${color}; padding: 1px; border-radius:4px; color: ${color};`,
    "background:transparent",
  ];
  console.log(...logArgs);
}
// 输出带字体背景
function printWithTextBackground(text: string, color: string) {
  const logArgs = [
    `%c ${text} `,
    `background:${color}; padding: 2px; border-radius: 4px;color: #fff;`,
  ];
  console.log(...logArgs);
}
// 输出标题带字体背景，文字带字体颜色
function printWithTitleAndText(title: string, text: string, color: string) {
  const logArgs = [
    `%c ${title} %c ${text} %c`,
    `background:${color};border:1px solid ${color}; padding: 1px; border-radius: 4px 0 0 4px; color: #fff;`,
    `border:1px solid ${color}; padding: 1px; border-radius: 0 4px 4px 0; color: ${color};`,
    "background:transparent",
  ];
  console.log(...logArgs);
}
class GameLog {
  /**  level 0  */
  static log(...args: any[]) {
    if (LogLevel <= 0) {
      console.log(...args);
    }
  }

  /**  level 1  */
  static debug(...args: any[]) {
    if (LogLevel <= 1) {
      printWithTextBackground(args.join(""), LogConfig.debug.color);
    }
  }

  /**  level 2  */
  static info(...args: any[]) {
    if (LogLevel <= 2) {
      printWithTextColor(args.join(""), LogConfig.info.color);
    }
  }

  /**  level 3  */
  static warn(...args: any[]) {
    if (LogLevel <= 3) {
      printWithTitleAndText(
        args[0],
        args.slice(1, args.length).join(""),
        LogConfig.warn.color
      );
    }
  }

  /**  level 3  */
  static success(...args: any[]) {
    if (LogLevel <= 3) {
      printWithTitleAndText(
        args[0],
        args.slice(1, args.length).join(""),
        LogConfig.success.color
      );
    }
  }

  /**  level 4  */
  static error(...args: any[]) {
    printWithTitleAndText(
      args[0],
      args.slice(1, args.length).join(""),
      LogConfig.error.color
    );
  }
}
export default GameLog;
