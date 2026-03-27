import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ListMembersService {
  constructor(private prisma: PrismaService) {}

  async getMembers(listId: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!list) throw new NotFoundException('Shopping list not found');

    return {
      owner: list.owner,
      members: list.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async removeMember(listId: string, memberUserId: string, currentUserId: string) {
    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
    });
    if (!list) throw new NotFoundException('Shopping list not found');

    const isOwner = list.ownerId === currentUserId;
    const isSelf = memberUserId === currentUserId;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException('Only the owner can remove members');
    }

    const member = await this.prisma.listMember.findUnique({
      where: { listId_userId: { listId, userId: memberUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.listMember.delete({
      where: { listId_userId: { listId, userId: memberUserId } },
    });
  }
}
