/**
 * Centralized messages module for all application messages
 * All string literals are stored here for easy maintenance and internationalization
 */

// ============ Authentication Messages ============
export const AUTH_MESSAGES = {
  LOGIN_SUCCESSFUL: 'Login successful',
  SIGNUP_SUCCESSFUL: 'Signup successful',
  LOGOUT_SUCCESSFUL: 'Logged out successfully',
  SESSION_VALID: 'Session is valid',
  SESSION_EXPIRED: 'Session token has expired',
  SESSION_INVALID: 'Session token is invalid or does not exist',
} as const;

// ============ Error Messages ============
export const ERROR_MESSAGES = {
  EMAIL_NOT_FOUND: 'Email address not found in the system',
  MISSING_INFORMATION: 'Email and password are required',
  INCORRECT_PASSWORD: 'Password is incorrect',
  INVALID_CREDENTIALS: 'Invalid credentials provided',
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  DATABASE_ERROR: 'Database error occurred',
  SESSION_CREATION_ERROR: 'Failed to create session token',
  CASSANDRA_CONNECTION_FAILED: 'Cassandra connection failed: {{error}}',
  CASSANDRA_INITIALIZATION_FAILED: 'Cassandra initialization failed: {{error}}',
  CASSANDRA_QUERY_FAILED: 'Cassandra query failed: {{error}}',
  CONFIG_LOAD_FAILED: 'Failed to load configuration from Cassandra: {{error}}',
  CONFIG_RELOAD_FAILED: 'Failed to reload configuration: {{error}}',
  CONFIG_USING_DEFAULTS: 'Using default configuration for environment: {{environment}}',
  ENCRYPTION_FAILED: 'Encryption failed: {{error}}',
  DECRYPTION_FAILED: 'Decryption failed: {{error}}',
  INVALID_API_KEY: 'Invalid or missing API key',
  API_KEY_INACTIVE: 'API key is inactive',
  MISSING_ENCRYPTED_PAYLOAD: 'Missing encrypted payload',
  INVALID_ENCRYPTED_FORMAT: 'Invalid encrypted payload format',
} as const;

// ============ Info Messages ============
export const INFO_MESSAGES = {
  REDIS_CONNECTED: 'Redis connected successfully',
  NEO4J_CONNECTED: 'Neo4j connected successfully',
  CASSANDRA_CONNECTED: 'Cassandra connected successfully at {{host}}',
  CASSANDRA_KEYSPACE_INITIALIZED: 'Cassandra keyspace {{keyspace}} initialized',
  CONFIG_LOADED_FROM_CASSANDRA: 'Application config loaded from Cassandra for environment: {{environment}}',
  CONFIG_SEEDED: 'Application config seeded in Cassandra for environment: {{environment}}',
  APPLICATION_STARTED: 'Application is running on port {{port}} [{{env}}]',
} as const;

// ============ Warning Messages ============
export const WARNING_MESSAGES = {
  MISSING_ENV_FILE: 'Environment file not found: {{filePath}}. Using env/.env.local as fallback.',
  LOGIN_MISSING_INFO: 'Login attempt with missing information',
  LOGIN_USER_NOT_FOUND: 'Login attempt for non-existent email',
  LOGIN_INCORRECT_PASSWORD: 'Login attempt with incorrect password',
} as const;

// ============ Log Messages ============
export const LOG_MESSAGES = {
  USER_LOGGED_IN: 'User logged in successfully',
  USER_LOGGED_OUT: 'User logged out',
  SESSION_VERIFIED: 'Session verified',
  SESSION_VERIFICATION_FAILED: 'Session verification failed',
  LOGIN_ERROR: 'Login error',
  LOGOUT_ERROR: 'Logout error',
  SESSION_VERIFICATION_ERROR: 'Session verification error',
  API_KEY_VALIDATED: 'API key validated for client: {{clientName}}',
  API_KEY_NOT_FOUND: 'API key not found: {{apiKey}}',
  API_KEY_INACTIVE: 'API key inactive for client: {{clientName}}',
  API_KEY_VALIDATION_ERROR: 'API key validation error: {{error}}',
  API_KEY_LOOKUP_ERROR: 'API key lookup error: {{error}}',
  PAYLOAD_DECRYPTED: 'Encrypted payload decrypted successfully',
  PAYLOAD_DECRYPTION_ERROR: 'Failed to decrypt payload: {{error}}',
} as const;

// Type for message replacement
export type MessageTemplateData = Record<string, string | number>;

/**
 * Replace template variables in messages
 * @param message Message with {{variable}} placeholders
 * @param data Object with values to replace
 * @returns Message with variables replaced
 */
export function interpolateMessage(
  message: string,
  data?: MessageTemplateData,
): string {
  if (!data) return message;

  let result = message;
  Object.entries(data).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });
  return result;
}
