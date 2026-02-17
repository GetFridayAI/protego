import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { Neo4jService } from './services/neo4j.service';
import { RedisService } from './services/redis.service';
import { BcryptService } from './services/bcrypt.service';

// Example DTO
export class CreateUserDto {
  username: string;
  password: string;
  email: string;
}

@Controller('api/example')
export class ExampleController {
  constructor(
    private neo4jService: Neo4jService,
    private redisService: RedisService,
    private bcryptService: BcryptService,
  ) {}

  /**
   * Example: Create a user in Neo4j with bcrypt-hashed password
   */
  @Post('users')
  async createUser(@Body() createUserDto: CreateUserDto) {
    // Hash the password
    const hashedPassword = await this.bcryptService.hash(createUserDto.password);

    // Create user in Neo4j
    const query = `
      CREATE (u:User {
        username: $username,
        email: $email,
        password: $password,
        createdAt: datetime()
      })
      RETURN u
    `;

    const result = await this.neo4jService.executeQuery(query, {
      username: createUserDto.username,
      email: createUserDto.email,
      password: hashedPassword,
    });

    // Cache the user info in Redis (without password)
    const cacheKey = `user:${createUserDto.username}`;
    await this.redisService.set(
      cacheKey,
      JSON.stringify({
        username: createUserDto.username,
        email: createUserDto.email,
      }),
      3600, // 1 hour TTL
    );

    return {
      message: 'User created successfully',
      user: {
        username: createUserDto.username,
        email: createUserDto.email,
      },
    };
  }

  /**
   * Example: Get user from cache or Neo4j
   */
  @Get('users/:username')
  async getUser(@Param('username') username: string) {
    const cacheKey = `user:${username}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return {
        source: 'cache',
        data: JSON.parse(cached),
      };
    }

    // Get from Neo4j if not in cache
    const query = `
      MATCH (u:User {username: $username})
      RETURN {
        username: u.username,
        email: u.email,
        createdAt: u.createdAt
      } as user
    `;

    const result = await this.neo4jService.executeQuery(query, { username });

    if (result.records.length === 0) {
      return { error: 'User not found' };
    }

    const user = result.records[0].get('user');

    // Cache the result
    await this.redisService.set(cacheKey, JSON.stringify(user), 3600);

    return {
      source: 'database',
      data: user,
    };
  }

  /**
   * Example: Verify password
   */
  @Post('auth/verify')
  async verifyPassword(
    @Body() body: { username: string; password: string },
  ) {
    const query = `
      MATCH (u:User {username: $username})
      RETURN u.password as hash
    `;

    const result = await this.neo4jService.executeQuery(query, {
      username: body.username,
    });

    if (result.records.length === 0) {
      return { valid: false, message: 'User not found' };
    }

    const hash = result.records[0].get('hash');
    const isValid = await this.bcryptService.compare(body.password, hash);

    return {
      valid: isValid,
      message: isValid ? 'Password is correct' : 'Password is incorrect',
    };
  }

  /**
   * Example: Clear user cache
   */
  @Post('cache/clear/:username')
  async clearUserCache(@Param('username') username: string) {
    const cacheKey = `user:${username}`;
    const existed = await this.redisService.exists(cacheKey);

    if (existed) {
      await this.redisService.delete(cacheKey);
      return { message: 'Cache cleared' };
    }

    return { message: 'No cache to clear' };
  }

  /**
   * Example: Get all users from Neo4j
   */
  @Get('users')
  async getAllUsers() {
    const query = `
      MATCH (u:User)
      RETURN {
        username: u.username,
        email: u.email
      } as user
    `;

    const result = await this.neo4jService.executeQuery(query);

    return {
      total: result.records.length,
      users: result.records.map((record) => record.get('user')),
    };
  }
}
