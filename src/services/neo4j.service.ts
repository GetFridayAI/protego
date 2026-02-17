import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Driver, neo4j } from 'neo4j';
import { LoggerService } from './logger.service';
import { DynamicConfigService } from './dynamic-config.service';
import { interpolateMessage, INFO_MESSAGES } from '../common/messages';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;

  constructor(
    private dynamicConfigService: DynamicConfigService,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    const scheme = this.dynamicConfigService.getConfig<string>('neo4jScheme');
    const host = this.dynamicConfigService.getConfig<string>('neo4jHost');
    const port = this.dynamicConfigService.getConfig<number>('neo4jPort');
    const username = this.dynamicConfigService.getConfig<string>('neo4jUsername');
    const password = this.dynamicConfigService.getConfig<string>('neo4jPassword');

    const uri = `${scheme}://${host}:${port}`;

    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

    // Verify connectivity
    await this.driver.getServerInfo();
    this.logger.info(INFO_MESSAGES.NEO4J_CONNECTED);
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
    }
  }

  getDriver(): Driver {
    return this.driver;
  }

  async executeQuery(query: string, parameters?: Record<string, any>) {
    const session = this.driver.session();
    try {
      const result = await session.run(query, parameters);
      return result;
    } finally {
      await session.close();
    }
  }
}
