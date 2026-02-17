import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DynamicConfigService } from './dynamic-config.service';

@Injectable()
export class BcryptService {
  constructor(private dynamicConfigService: DynamicConfigService) {}

  private getSaltRounds(): number {
    return this.dynamicConfigService.getConfigWithFallback('bcryptRounds', 10);
  }

  async hash(password: string): Promise<string> {
    const saltRounds = this.getSaltRounds();
    return bcrypt.hash(password, saltRounds);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
