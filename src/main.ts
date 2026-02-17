import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getEnvFilePath } from './config/env.loader';
import { DynamicConfigService } from './services/dynamic-config.service';
import { interpolateMessage, INFO_MESSAGES } from './common/messages/messages';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

async function bootstrap() {
  // Load environment-specific .env file
  const envFilePath = getEnvFilePath();
  if (fs.existsSync(envFilePath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envFilePath));
    Object.assign(process.env, envConfig);
  }

  const app = await NestFactory.create(AppModule);

  // Get config service
  const configService = app.get(DynamicConfigService);

  // Wait a moment to ensure config is loaded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const port = configService.getConfigWithFallback('port', 3000);
  const env = configService.getEnvironment();

  await app.listen(port);
  console.log(
    interpolateMessage(INFO_MESSAGES.APPLICATION_STARTED, {
      port,
      env,
    }),
  );
}

bootstrap();
