import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './services/database.module';
import { LoginController } from './controllers/login.controller';
import { databaseConfig } from './config/database.config';
import {
  appConfig,
  securityConfig,
  kafkaConfig,
  performanceConfig,
  monitoringConfig,
} from './config/app.config';
import { getEnvFilePath } from './config/env.loader';
import { ApiKeyGuard } from './guards/api-key.guard';
import { DecryptPayloadInterceptor } from './interceptors/decrypt-payload.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePath(),
      load: [
        databaseConfig,
        appConfig,
        securityConfig,
        kafkaConfig,
        performanceConfig,
        monitoringConfig,
      ],
    }),
    DatabaseModule,
  ],
  controllers: [AppController, LoginController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DecryptPayloadInterceptor,
    },
  ],
})
export class AppModule {}
