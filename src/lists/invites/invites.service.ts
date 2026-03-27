import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ShareByEmailDto, GenerateInviteDto } from '../dto';

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService) {}

  async shareByEmail(listId: string, dto: ShareByEmailDto, inviterId: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const existing = await this.prisma.listMember.findUnique({
        where: { listId_userId: { listId, userId: user.id } },
      });
      if (existing) throw new ConflictException('User is already a member');

      await this.prisma.listMember.create({
        data: {
          listId,
          userId: user.id,
          role: dto.role || 'viewer',
        },
      });
      return { joined: true, userId: user.id };
    }

    const invite = await this.prisma.listInvite.create({
      data: {
        listId,
        invitedBy: inviterId,
        email: dto.email,
        role: dto.role || 'viewer',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { joined: false, inviteId: invite.id };
  }

  async generateInviteLink(
    listId: string,
    dto: GenerateInviteDto,
    inviterId: string,
  ) {
    const invite = await this.prisma.listInvite.create({
      data: {
        listId,
        invitedBy: inviterId,
        role: dto.role || 'viewer',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { inviteId: invite.id };
  }

  async getInvite(inviteId: string) {
    const invite = await this.prisma.listInvite.findUnique({
      where: { id: inviteId },
      include: {
        list: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } },
      },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) {
      throw new ForbiddenException('Invite has expired');
    }
    return invite;
  }

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.listInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) {
      throw new ForbiddenException('Invite has expired');
    }
    if (invite.accepted) {
      throw new ConflictException('Invite already accepted');
    }

    const existing = await this.prisma.listMember.findUnique({
      where: { listId_userId: { listId: invite.listId, userId } },
    });
    if (existing) throw new ConflictException('Already a member');

    await this.prisma.$transaction([
      this.prisma.listMember.create({
        data: {
          listId: invite.listId,
          userId,
          role: invite.role,
        },
      }),
      this.prisma.listInvite.update({
        where: { id: inviteId },
        data: { accepted: true },
      }),
    ]);

    return { listId: invite.listId, role: invite.role };
  }
}
