import type { User } from '@prisma/client';

const toNumberOrNull = (value: unknown): number | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value) || null;
};

const normalizeOutgoingRole = (role: string): string => {
  if (role === 'delivery') {
    return 'deliveryAgent';
  }
  return role;
};

export const normalizeIncomingRole = (role: string): string => {
  if (role === 'deliveryAgent' || role === 'delivery_agent') {
    return 'delivery';
  }
  return role;
};

export const toPublicUser = (user: User) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber ?? '',
  address: user.address,
  role: normalizeOutgoingRole(user.role),
  locale: user.locale,
  status: user.status,
  radiusKm: user.radiusKm,
  profileImage: user.profileImage,
  isActive: user.isActive,
  latitude: toNumberOrNull(user.latitude),
  longitude: toNumberOrNull(user.longitude),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
