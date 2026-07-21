import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as readline from 'readline';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

function generateStrongPassword(length = 24): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const all = upper + lower + digits + special;

  // Ensure at least one of each category
  const required = [
    upper[crypto.randomInt(upper.length)],
    lower[crypto.randomInt(lower.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  const remaining = Array.from({ length: length - 4 }, () =>
    all[crypto.randomInt(all.length)],
  );

  const combined = [...required, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

async function askToProceed(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      'This will DELETE all existing data and seed fresh data. Continue? (y/N) ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      },
    );
  });
}

async function main() {
  const proceed = await askToProceed();
  if (!proceed) {
    console.log('Seed cancelled.');
    return;
  }

  console.log('Clearing existing data...');
  await prisma.ticket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingFoodItem.deleteMany();
  await prisma.bookingSeat.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.showtime.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.screenTemplateSeat.deleteMany();
  await prisma.seatLayout.deleteMany();
  await prisma.screenTemplate.deleteMany();
  await prisma.seatPricingRule.deleteMany();
  await prisma.foodItem.deleteMany();
  await prisma.foodCategory.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.file.deleteMany();
  await prisma.theater.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.loginSession.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.twoFactorAuth.deleteMany();
  await prisma.oAuthAccount.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.account.deleteMany();

  console.log('Seeding data...');

  // ── Accounts ──────────────────────────────────────────────
  const adminPassword = generateStrongPassword(32);
  const userPassword = generateStrongPassword(32);
  const cashierPassword = generateStrongPassword(32);

  const adminPasswordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  const userPasswordHash = await bcrypt.hash(userPassword, SALT_ROUNDS);
  const cashierPasswordHash = await bcrypt.hash(cashierPassword, SALT_ROUNDS);

  const adminAccount = await prisma.account.create({
    data: {
      email: 'admin@cinema.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          phone: '+85512345678',
          status: 'ACTIVE',
        },
      },
    },
  });

  const userAccount = await prisma.account.create({
    data: {
      email: 'user@cinema.com',
      passwordHash: userPasswordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+85598765432',
          status: 'ACTIVE',
        },
      },
    },
  });

  const cashierAccount = await prisma.account.create({
    data: {
      email: 'cashier@cinema.com',
      passwordHash: cashierPasswordHash,
      role: 'CASHIER',
      status: 'ACTIVE',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Cashier',
          lastName: 'One',
          phone: '+85511112222',
          status: 'ACTIVE',
        },
      },
    },
  });

  // ── Seat Pricing Rules ────────────────────────────────────
  const pricingRules = await Promise.all([
    prisma.seatPricingRule.create({
      data: { seatType: 'STANDARD', seatSurcharge: 0.0, isActive: true },
    }),
    prisma.seatPricingRule.create({
      data: { seatType: 'VIP', seatSurcharge: 5.0, isActive: true },
    }),
    prisma.seatPricingRule.create({
      data: { seatType: 'COUPLE', seatSurcharge: 8.0, isActive: true },
    }),
    prisma.seatPricingRule.create({
      data: { seatType: 'WHEELCHAIR', seatSurcharge: 0.0, isActive: true },
    }),
  ]);

  // ── Screen Templates & Layouts ────────────────────────────
  const standardTemplate = await prisma.screenTemplate.create({
    data: {
      name: 'Standard Template',
      type: 'STANDARD',
      description: 'Standard cinema screen layout',
      isActive: true,
      screenSurcharge: 0.0,
    },
  });

  const vipTemplate = await prisma.screenTemplate.create({
    data: {
      name: 'VIP Template',
      type: 'VIP',
      description: 'VIP cinema screen with premium seats',
      isActive: true,
      screenSurcharge: 3.0,
    },
  });

  const imaxTemplate = await prisma.screenTemplate.create({
    data: {
      name: 'IMAX Template',
      type: 'IMAX',
      description: 'Large format IMAX screen',
      isActive: true,
      screenSurcharge: 5.0,
    },
  });

  const threeDTemplate = await prisma.screenTemplate.create({
    data: {
      name: '3D Template',
      type: 'THREE_D',
      description: '3D cinema screen',
      isActive: true,
      screenSurcharge: 2.0,
    },
  });

  // Standard layout — 8 rows (A-H) × 10 seats
  const standardLayout = await prisma.seatLayout.create({
    data: {
      name: 'Standard Layout',
      templateId: standardTemplate.id,
    },
  });

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const standardSeatData: Array<{
    layoutId: string;
    seatRow: string;
    seatNumber: number;
    posX: number;
    posY: number;
    seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
  }> = [];

  for (const [rowIdx, row] of rows.entries()) {
    for (let seatNum = 1; seatNum <= 10; seatNum++) {
      let seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR' = 'STANDARD';
      if (row === 'A' && seatNum <= 2) seatType = 'WHEELCHAIR';
      else if (row === 'H') seatType = 'VIP';
      standardSeatData.push({
        layoutId: standardLayout.id,
        seatRow: row,
        seatNumber: seatNum,
        posX: (seatNum - 1) * 50,
        posY: rowIdx * 50,
        seatType,
      });
    }
  }

  await prisma.screenTemplateSeat.createMany({ data: standardSeatData });

  // VIP layout — 6 rows (A-F) × 8 seats, all VIP
  const vipLayout = await prisma.seatLayout.create({
    data: {
      name: 'VIP Layout',
      templateId: vipTemplate.id,
    },
  });

  const vipRows = ['A', 'B', 'C', 'D', 'E', 'F'];
  const vipSeatData: Array<{
    layoutId: string;
    seatRow: string;
    seatNumber: number;
    posX: number;
    posY: number;
    seatType: 'VIP';
  }> = [];

  for (const [rowIdx, row] of vipRows.entries()) {
    for (let seatNum = 1; seatNum <= 8; seatNum++) {
      vipSeatData.push({
        layoutId: vipLayout.id,
        seatRow: row,
        seatNumber: seatNum,
        posX: (seatNum - 1) * 50,
        posY: rowIdx * 50,
        seatType: 'VIP',
      });
    }
  }

  await prisma.screenTemplateSeat.createMany({ data: vipSeatData });

  // IMAX layout — 10 rows (A-J) × 14 seats
  const imaxLayout = await prisma.seatLayout.create({
    data: {
      name: 'IMAX Layout',
      templateId: imaxTemplate.id,
    },
  });

  const imaxRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const imaxSeatData: Array<{
    layoutId: string;
    seatRow: string;
    seatNumber: number;
    posX: number;
    posY: number;
    seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
  }> = [];

  for (const [rowIdx, row] of imaxRows.entries()) {
    for (let seatNum = 1; seatNum <= 14; seatNum++) {
      let seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR' = 'STANDARD';
      if (row === 'A' && seatNum <= 2) seatType = 'WHEELCHAIR';
      else if (row === 'J') seatType = 'VIP';
      imaxSeatData.push({
        layoutId: imaxLayout.id,
        seatRow: row,
        seatNumber: seatNum,
        posX: (seatNum - 1) * 50,
        posY: rowIdx * 50,
        seatType,
      });
    }
  }

  await prisma.screenTemplateSeat.createMany({ data: imaxSeatData });

  // 3D layout — 8 rows (A-H) × 10 seats
  const threeDLayout = await prisma.seatLayout.create({
    data: {
      name: '3D Layout',
      templateId: threeDTemplate.id,
    },
  });

  const threeDSeatData: Array<{
    layoutId: string;
    seatRow: string;
    seatNumber: number;
    posX: number;
    posY: number;
    seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
  }> = [];

  for (const [rowIdx, row] of rows.entries()) {
    for (let seatNum = 1; seatNum <= 10; seatNum++) {
      let seatType: 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR' = 'STANDARD';
      if (row === 'A' && seatNum <= 2) seatType = 'WHEELCHAIR';
      else if (row === 'H') seatType = 'VIP';
      threeDSeatData.push({
        layoutId: threeDLayout.id,
        seatRow: row,
        seatNumber: seatNum,
        posX: (seatNum - 1) * 50,
        posY: rowIdx * 50,
        seatType,
      });
    }
  }

  await prisma.screenTemplateSeat.createMany({ data: threeDSeatData });

  // ── Theaters & Screens ────────────────────────────────────
  const theater1 = await prisma.theater.create({
    data: {
      name: 'Major Cineplex Exchange Square',
      location: 'Exchange Square, Phnom Penh',
      city: 'Phnom Penh',
      phone: '+85523456789',
      email: 'exchange@majorcineplex.com',
      status: 'ACTIVE',
    },
  });

  const theater2 = await prisma.theater.create({
    data: {
      name: 'Major Cineplex Aeon Mall',
      location: 'Aeon Mall Sen Sok, Phnom Penh',
      city: 'Phnom Penh',
      phone: '+85523456790',
      email: 'aeon@majorcineplex.com',
      status: 'ACTIVE',
    },
  });

  const theater3 = await prisma.theater.create({
    data: {
      name: 'Major Cineplex Sihanoukville',
      location: 'Golden Lions Roundabout, Sihanoukville',
      city: 'Sihanoukville',
      phone: '+85523456791',
      email: 'sihanoukville@majorcineplex.com',
      status: 'ACTIVE',
    },
  });

  async function createScreensFromTemplate(
    theaterId: string,
    templateId: string,
    screenName: string,
    screenType: 'STANDARD' | 'VIP' | 'IMAX' | 'THREE_D',
  ) {
    const templateSeats = await prisma.screenTemplateSeat.findMany({
      where: { layout: { templateId } },
    });

    const screen = await prisma.screen.create({
      data: {
        theaterId,
        templateId,
        name: screenName,
        type: screenType,
      },
    });

    const seatData = templateSeats.map((ts) => ({
      screenId: screen.id,
      seatRow: ts.seatRow,
      seatNumber: ts.seatNumber,
      posX: ts.posX,
      posY: ts.posY,
      seatType: ts.seatType as
        | 'STANDARD'
        | 'VIP'
        | 'COUPLE'
        | 'WHEELCHAIR',
      status: 'ACTIVE' as const,
    }));

    await prisma.seat.createMany({ data: seatData });

    return screen;
  }

  // Theater 1: Exchange Square — 3 screens
  const screen1 = await createScreensFromTemplate(
    theater1.id,
    standardTemplate.id,
    'Screen 1',
    'STANDARD',
  );
  const screen2 = await createScreensFromTemplate(
    theater1.id,
    vipTemplate.id,
    'VIP Screen',
    'VIP',
  );
  const screen3 = await createScreensFromTemplate(
    theater1.id,
    imaxTemplate.id,
    'IMAX Screen',
    'IMAX',
  );

  // Theater 2: Aeon Mall — 3 screens
  const screen4 = await createScreensFromTemplate(
    theater2.id,
    standardTemplate.id,
    'Screen A',
    'STANDARD',
  );
  const screen5 = await createScreensFromTemplate(
    theater2.id,
    standardTemplate.id,
    'Screen B',
    'STANDARD',
  );
  const screen6 = await createScreensFromTemplate(
    theater2.id,
    threeDTemplate.id,
    '3D Screen',
    'THREE_D',
  );

  // Theater 3: Sihanoukville — 2 screens
  const screen7 = await createScreensFromTemplate(
    theater3.id,
    standardTemplate.id,
    'Screen 1',
    'STANDARD',
  );
  const screen8 = await createScreensFromTemplate(
    theater3.id,
    vipTemplate.id,
    'VIP Screen',
    'VIP',
  );

  // ── Movies ────────────────────────────────────────────────
  const now = new Date();

  const movie1 = await prisma.movie.create({
    data: {
      title: 'Avengers: Endgame',
      description:
        "After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos' actions and restore balance to the universe.",
      durationMinutes: 181,
      language: 'English',
      releaseDate: new Date('2025-04-26'),
      status: 'NOW_SHOWING',
    },
  });

  const movie2 = await prisma.movie.create({
    data: {
      title: 'Spider-Man: No Way Home',
      description:
        "Peter Parker's identity is revealed, forcing him to seek help from Doctor Strange.",
      durationMinutes: 148,
      language: 'English',
      releaseDate: new Date('2025-12-17'),
      status: 'NOW_SHOWING',
    },
  });

  const movie3 = await prisma.movie.create({
    data: {
      title: 'Dune: Part Two',
      description:
        'Paul Atreides continues his journey through the desert planet of Arrakis.',
      durationMinutes: 166,
      language: 'English',
      releaseDate: new Date('2026-03-01'),
      status: 'NOW_SHOWING',
    },
  });

  const movie4 = await prisma.movie.create({
    data: {
      title: 'Inside Out 2',
      description:
        'Follow Riley and her emotions as she navigates new challenges during her teenage years.',
      durationMinutes: 100,
      language: 'English',
      releaseDate: new Date('2026-06-14'),
      status: 'COMING_SOON',
    },
  });

  const movie5 = await prisma.movie.create({
    data: {
      title: 'The Batman 2',
      description: 'The Dark Knight returns to face a new threat in Gotham City.',
      durationMinutes: 175,
      language: 'English',
      releaseDate: new Date('2026-10-03'),
      status: 'COMING_SOON',
    },
  });

  const movie6 = await prisma.movie.create({
    data: {
      title: 'Oppenheimer',
      description:
        'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.',
      durationMinutes: 180,
      language: 'English',
      releaseDate: new Date('2025-07-21'),
      status: 'NOW_SHOWING',
    },
  });

  const movie7 = await prisma.movie.create({
    data: {
      title: 'John Wick: Chapter 4',
      description:
        'John Wick uncovers a path to defeating The High Table in his quest for freedom.',
      durationMinutes: 169,
      language: 'English',
      releaseDate: new Date('2025-03-24'),
      status: 'NOW_SHOWING',
    },
  });

  const movie8 = await prisma.movie.create({
    data: {
      title: 'Interstellar',
      description:
        "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
      durationMinutes: 169,
      language: 'English',
      releaseDate: new Date('2024-11-07'),
      status: 'NOW_SHOWING',
    },
  });

  // ── Showtimes ─────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const showtimeData: Array<{
    movieId: string;
    screenId: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    status: 'SCHEDULED' | 'CANCELLED' | 'FINISHED';
  }> = [];

  const movies = [movie1, movie2, movie3, movie6, movie7, movie8];
  const screens = [
    screen1, screen2, screen3,
    screen4, screen5, screen6,
    screen7, screen8,
  ];

  for (const movie of movies) {
    for (let day = 0; day < 7; day++) {
      for (const screen of screens) {
        const hours = [10, 13, 16, 19, 22];
        for (const hour of hours) {
          const startTime = new Date(today);
          startTime.setDate(startTime.getDate() + day);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + movie.durationMinutes);

          const isPast = startTime < now;

          showtimeData.push({
            movieId: movie.id,
            screenId: screen.id,
            startTime,
            endTime,
            basePrice: hour >= 19 ? 12.0 : 8.0,
            status: isPast
              ? ('FINISHED' as const)
              : ('SCHEDULED' as const),
          });
        }
      }
    }
  }

  await prisma.showtime.createMany({ data: showtimeData });

  // ── Food Categories & Items ───────────────────────────────
  const popcorn = await prisma.foodCategory.create({
    data: { name: 'Popcorn', sortOrder: 1, isActive: true },
  });

  const drinks = await prisma.foodCategory.create({
    data: { name: 'Drinks', sortOrder: 2, isActive: true },
  });

  const snacks = await prisma.foodCategory.create({
    data: { name: 'Snacks', sortOrder: 3, isActive: true },
  });

  const combos = await prisma.foodCategory.create({
    data: { name: 'Combos', sortOrder: 4, isActive: true },
  });

  await prisma.foodItem.createMany({
    data: [
      { name: 'Small Popcorn', price: 3.5, categoryId: popcorn.id, sortOrder: 1 },
      { name: 'Medium Popcorn', price: 5.0, categoryId: popcorn.id, sortOrder: 2 },
      { name: 'Large Popcorn', price: 6.5, categoryId: popcorn.id, sortOrder: 3 },
      { name: 'Caramel Popcorn', price: 5.5, categoryId: popcorn.id, sortOrder: 4 },
      { name: 'Water', price: 1.5, categoryId: drinks.id, sortOrder: 1 },
      { name: 'Coca-Cola', price: 2.0, categoryId: drinks.id, sortOrder: 2 },
      { name: 'Sprite', price: 2.0, categoryId: drinks.id, sortOrder: 3 },
      { name: 'Orange Juice', price: 2.5, categoryId: drinks.id, sortOrder: 4 },
      { name: 'Nachos', price: 4.0, categoryId: snacks.id, sortOrder: 1 },
      { name: 'Hot Dog', price: 3.5, categoryId: snacks.id, sortOrder: 2 },
      { name: 'Candy Pack', price: 2.5, categoryId: snacks.id, sortOrder: 3 },
      { name: 'Popcorn + Drink Combo', price: 7.0, categoryId: combos.id, sortOrder: 1 },
      { name: 'Double Popcorn + 2 Drinks', price: 12.0, categoryId: combos.id, sortOrder: 2 },
    ],
  });

  // ── Summary ──────────────────────────────────────────────
  const counts = {
    accounts: await prisma.account.count(),
    movies: await prisma.movie.count(),
    theaters: await prisma.theater.count(),
    screens: await prisma.screen.count(),
    seats: await prisma.seat.count(),
    showtimes: await prisma.showtime.count(),
    foodItems: await prisma.foodItem.count(),
    pricingRules: await prisma.seatPricingRule.count(),
  };

  console.log('\n✅ Seed complete!');
  console.table(counts);
  console.log('\n📧 Admin login:   admin@cinema.com / ' + adminPassword);
  console.log('📧 User login:    user@cinema.com / ' + userPassword);
  console.log('📧 Cashier login: cashier@cinema.com / ' + cashierPassword);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
