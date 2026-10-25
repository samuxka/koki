import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsService } from './memberships.service';
import { Membership, MembershipSchema } from './schemas/membership.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  providers: [MembershipsService],
  exports: [MembershipsService, MongooseModule],
})
export class MembershipsModule {}
