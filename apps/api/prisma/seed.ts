import { Prisma, PrismaClient, Resource, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com';
  const adminName = process.env.ADMIN_SEED_NAME ?? 'Admin';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMe123!';
  const adminPasswordHash = await hash(adminPassword, 12);
  const rawTelegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramBotToken =
    rawTelegramToken && rawTelegramToken.length > 0 ? rawTelegramToken : null;

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      name: adminName,
      disabled: false,
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: Role.admin,
      passwordHash: adminPasswordHash,
      disabled: false,
      permissions: {
        create: Object.values(Resource).map((resource) => ({
          resource,
          read: true,
          write: true,
        })),
      },
    },
    include: { permissions: true },
  });

  const product = await prisma.product.upsert({
    where: { code: 'SKU-001' },
    update: {},
    create: {
      code: 'SKU-001',
      name: '샘플 제품',
      description: '초기 재고 확인용 샘플 아이템',
      specification: '10x20cm / Blue',
      unit: 'EA',
      safetyStock: 10,
      totalIn: 50,
      remain: 50,
    },
  });

  const notificationUpdateData: Prisma.NotificationSettingUpdateInput = {};
  if (telegramBotToken) {
    notificationUpdateData.telegramBotToken = telegramBotToken;
    notificationUpdateData.telegramEnabled = true;
  }

  await prisma.notificationSetting.upsert({
    where: { id: 'default-notification-setting' },
    update: notificationUpdateData,
    create: {
      id: 'default-notification-setting',
      telegramEnabled: telegramBotToken !== null,
      telegramCooldownMin: 60,
      telegramQuietHours: '22-07',
      telegramBotToken: telegramBotToken,
      createdBy: { connect: { id: admin.id } },
      telegramTargets: {
        create: [
          {
            chatId: '000000000',
            label: '운영팀',
            enabled: false,
          },
        ],
      },
    },
  });

  await prisma.inbound.create({
    data: {
      product: { connect: { id: product.id } },
      quantity: 50,
      dateIn: new Date(),
      note: '초기 입고',
    },
  });
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
