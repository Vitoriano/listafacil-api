import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const LIST_ACCESS_ROLES_KEY = 'listAccessRoles';

@Injectable()
export class ListAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const listId = request.params.id;

    if (!userId || !listId) {
      throw new ForbiddenException();
    }

    const list = await this.prisma.shoppingList.findUnique({
      where: { id: listId },
      include: {
        members: { where: { userId }, select: { role: true } },
      },
    });

    if (!list) {
      throw new NotFoundException('Shopping list not found');
    }

    const isOwner = list.ownerId === userId;
    const membership = list.members[0];

    const allowedRoles = this.reflector.get<string[]>(
      LIST_ACCESS_ROLES_KEY,
      context.getHandler(),
    ) || ['owner', 'editor', 'viewer'];

    if (isOwner && allowedRoles.includes('owner')) {
      return true;
    }

    if (membership) {
      if (allowedRoles.includes(membership.role)) {
        return true;
      }
    }

    throw new ForbiddenException(
      'You do not have access to this shopping list',
    );
  }
}
