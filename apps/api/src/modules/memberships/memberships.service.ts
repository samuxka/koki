import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Membership, MembershipDocument } from './schemas/membership.schema';
import { UserRole } from '@koki/types';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectModel(Membership.name)
    private membershipModel: Model<MembershipDocument>,
  ) {}

  async create(data: {
    userId: Types.ObjectId | string;
    companyId: Types.ObjectId | string;
    role: UserRole;
    permissions?: string[];
  }): Promise<MembershipDocument> {
    return this.membershipModel.create({
      userId: new Types.ObjectId(data.userId.toString()),
      companyId: new Types.ObjectId(data.companyId.toString()),
      role: data.role,
      permissions: data.permissions || [],
    });
  }

  async findByUserAndCompany(
    userId: Types.ObjectId | string,
    companyId: Types.ObjectId | string,
  ): Promise<MembershipDocument | null> {
    return this.membershipModel.findOne({
      userId: new Types.ObjectId(userId.toString()),
      companyId: new Types.ObjectId(companyId.toString()),
    });
  }

  async findByUser(userId: Types.ObjectId | string): Promise<MembershipDocument[]> {
    return this.membershipModel
      .find({ userId: new Types.ObjectId(userId.toString()) })
      .populate('companyId')
      .exec();
  }
}
