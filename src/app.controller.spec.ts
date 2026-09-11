import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getDataSourceToken(),
          useValue: {
            query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
            options: { database: 'ecommerce' },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health/db', () => {
    it('reports the database as reachable', async () => {
      await expect(appController.checkDatabase()).resolves.toEqual({
        status: 'ok',
        database: 'ecommerce',
      });
    });
  });
});
