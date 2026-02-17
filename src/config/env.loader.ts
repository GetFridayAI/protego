import * as fs from 'fs';
import * as path from 'path';
import { interpolateMessage } from '../common/messages/messages';
import { WARNING_MESSAGES } from '../common/messages/messages';

export type Environment = 'local' | 'dev' | 'stage' | 'prod';

/**
 * Load environment file based on NODE_ENV or provided environment
 * @param env - Environment to load (local, dev, stage, prod)
 * @returns Path to environment file
 */
export function getEnvFilePath(env?: Environment): string {
  const environment = env || (process.env.NODE_ENV as Environment) || 'local';
  const envFile = `.env.${environment}`;
  const filePath = path.join(process.cwd(), 'env', envFile);

  if (!fs.existsSync(filePath)) {
    console.warn(
      interpolateMessage(WARNING_MESSAGES.MISSING_ENV_FILE, {
        filePath,
      }),
    );
    return path.join(process.cwd(), 'env', '.env.local');
  }

  return filePath;
}

/**
 * Get all valid environment names
 */
export function getValidEnvironments(): string[] {
  return ['local', 'dev', 'stage', 'prod'];
}

/**
 * Check if provided environment is valid
 */
export function isValidEnvironment(env: string): env is Environment {
  return getValidEnvironments().includes(env);
}
