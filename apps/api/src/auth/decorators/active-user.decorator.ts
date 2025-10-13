import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { ActiveUserData } from '../types/active-user-data';

export const ActiveUser = createParamDecorator(
  (data: keyof ActiveUserData | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: ActiveUserData }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
