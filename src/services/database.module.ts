import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Neo4jService } from './neo4j.service';
import { RedisService } from './redis.service';
import { BcryptService } from './bcrypt.service';
import { LoggerService } from './logger.service';
import { AuthService } from './auth.service';
import { CassandraService } from './cassandra.service';
import { EncryptionService } from './encryption.service';
import { ApiKeyService } from './api-key.service';
import { DynamicConfigService } from './dynamic-config.service';
import { databaseConfig } from '../config/database.config';

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [
    LoggerService,
    CassandraService,
    // DynamicConfigService should be initialized early, after Cassandra
    DynamicConfigService,
    // These services can now use DynamicConfigService if needed
    Neo4jService,
    RedisService,
    BcryptService,
    AuthService,
    EncryptionService,
    ApiKeyService,
  ],
  exports: [
    LoggerService,
    CassandraService,
    DynamicConfigService,
    Neo4jService,
    RedisService,
    BcryptService,
    AuthService,
    EncryptionService,
    ApiKeyService,
  ],
})
export class DatabaseModule {}
