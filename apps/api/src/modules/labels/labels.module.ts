import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { LabelBatch, LabelBatchSchema } from './schemas/label-batch.schema';
import { Company, CompanySchema } from '../companies/schemas/company.schema';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LabelBatch.name, schema: LabelBatchSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    EntitlementsModule,
    CompaniesModule,
  ],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService, MongooseModule],
})
export class LabelsModule {}
