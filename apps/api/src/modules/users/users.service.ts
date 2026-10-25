import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { UserPreferences } from '@koki/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
  }): Promise<UserDocument> {
    const user = new this.userModel({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      fullName: data.fullName.trim(),
      phone: data.phone?.trim(),
      emailVerified: false,
      preferences: {
        hideValues: false,
        language: 'pt',
        theme: 'light',
      },
    });
    return user.save();
  }

  async setCurrentCompany(userId: string | Types.ObjectId, companyId: string | Types.ObjectId): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      currentCompanyId: new Types.ObjectId(companyId.toString()),
    });
  }

  async updatePreferences(
    userId: string | Types.ObjectId,
    preferences: Partial<UserPreferences>,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    user.preferences = {
      ...user.preferences,
      ...preferences,
    };
    return user.save();
  }

  // Refresh Token management
  async saveRefreshToken(
    userId: Types.ObjectId,
    tokenHash: string,
    expiresAt: Date,
    deviceId?: string,
    userAgent?: string,
  ): Promise<RefreshTokenDocument> {
    return this.refreshTokenModel.create({
      userId,
      tokenHash,
      expiresAt,
      deviceId,
      userAgent,
    });
  }

  async findValidRefreshToken(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return this.refreshTokenModel.findOne({
      tokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
  }

  async revokeRefreshToken(tokenHash: string, replacedByTokenHash?: string): Promise<void> {
    await this.refreshTokenModel.updateOne(
      { tokenHash },
      {
        revokedAt: new Date(),
        replacedByTokenHash,
      },
    );
  }

  async revokeAllUserTokens(userId: Types.ObjectId): Promise<void> {
    await this.refreshTokenModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }
}
