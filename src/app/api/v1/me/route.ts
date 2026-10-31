import { route } from '@/lib/api/handler';

export const GET = route({ access: 'any' }, async ({ user }) => user);
