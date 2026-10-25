import { Module, Global, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        let uri = configService.get<string>('mongodb.uri');

        if (uri && uri.trim().length > 0) {
          logger.log(`Conectando ao MongoDB configurado: ${uri.replace(/\/\/.*@/, '//***:***@')}`);
          return { uri };
        }

        logger.warn('Nenhuma MONGODB_URI encontrada. Inicializando MongoDB Memory Server para desenvolvimento local...');
        try {
          const { MongoMemoryServer } = await import('mongodb-memory-server');
          const mongod = await MongoMemoryServer.create({
            instance: {
              dbName: 'koki_local_dev',
            },
          });
          uri = mongod.getUri();
          logger.log(`MongoDB Memory Server ativo em: ${uri}`);
          return { uri };
        } catch (error) {
          logger.error('Falha ao inicializar MongoMemoryServer fallback. Tentando localhost padrão...', error);
          return { uri: 'mongodb://localhost:27017/koki' };
        }
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
