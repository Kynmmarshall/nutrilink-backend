import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('ChangeMe123!');

  const [admin, provider, beneficiary, delivery] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@nutrilink.com' },
      update: {},
      create: {
        fullName: 'Platform Admin',
        email: 'admin@nutrilink.com',
        passwordHash,
        role: 'admin',
        status: 'approved',
        phoneNumber: '+1-555-0000',
        address: 'Global Operations',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    }),
    prisma.user.upsert({
      where: { email: 'provider@nutrilink.com' },
      update: {},
      create: {
        fullName: 'Good Bites Kitchen',
        email: 'provider@nutrilink.com',
        passwordHash,
        role: 'provider',
        status: 'approved',
        address: '42 Market Street',
        phoneNumber: '+1-555-0101',
        latitude: 37.7765,
        longitude: -122.4172,
      },
    }),
    prisma.user.upsert({
      where: { email: 'beneficiary@nutrilink.com' },
      update: {},
      create: {
        fullName: 'Community Center',
        email: 'beneficiary@nutrilink.com',
        passwordHash,
        role: 'beneficiary',
        status: 'approved',
        phoneNumber: '+1-555-0102',
        address: 'Sunset District',
        latitude: 37.7516,
        longitude: -122.4477,
      },
    }),
    prisma.user.upsert({
      where: { email: 'delivery@nutrilink.com' },
      update: {},
      create: {
        fullName: 'Delivery Hero',
        email: 'delivery@nutrilink.com',
        passwordHash,
        role: 'delivery',
        status: 'approved',
        phoneNumber: '+1-555-0103',
        address: 'Mission District',
        latitude: 37.7599,
        longitude: -122.4148,
      },
    }),
  ]);

  const listing = await prisma.listing.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      providerId: provider.id,
      title: 'Family Meal Prep Bowls',
      description: 'Balanced bowls with grains, greens, and lean protein. Refrigerated and ready.',
      category: 'prepared',
      foodType: 'cooked',
      servingsTotal: 40,
      servingsLeft: 30,
      expiryAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      address: provider.address ?? '42 Market Street',
      latitude: provider.latitude,
      longitude: provider.longitude,
    },
  });

  await prisma.request.upsert({
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {},
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      listingId: listing.id,
      beneficiaryId: beneficiary.id,
      requestedServings: 10,
      notes: 'Needed for evening program',
      status: 'approved',
    },
  });

  console.log('Seed data ready:', {
    admin: admin.email,
    provider: provider.email,
    beneficiary: beneficiary.email,
    delivery: delivery.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
