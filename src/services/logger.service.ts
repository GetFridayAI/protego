import { Injectable } from '@nestjs/common';

export enum LogLevel {
  INFO = 'info',
  DEBUG = 'debug',
  WARN = 'warn',
  ERROR = 'error',
}

@Injectable()
export class LoggerService {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLog(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const levelUpper = level.toUpperCase();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${levelUpper}] ${message}${dataStr}`;
  }

  log(level: LogLevel, message: string, data?: any): void {
    const formattedLog = this.formatLog(level, message, data);
    console.log(formattedLog);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
}
