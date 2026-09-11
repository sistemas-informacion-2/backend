import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!!!!';
  }

  async checkDatabase(): Promise<{ status: string; database: string }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: this.dataSource.options.database as string };
  }
}
