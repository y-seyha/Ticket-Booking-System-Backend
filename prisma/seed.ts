import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);

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

  // Create screens from template seats
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
    theater2.id,
    standardTemplate.id,
    'Screen A',
    'STANDARD',
  );
  const screen4 = await createScreensFromTemplate(
    theater2.id,
    standardTemplate.id,
    'Screen B',
    'STANDARD',
  );

  // ── Movies ────────────────────────────────────────────────
  const now = new Date();

  const movie1 = await prisma.movie.create({
    data: {
      title: 'Avengers: Endgame',
      description:
        'After the devastating events of Infinity War, the Avengers assemble once more to reverse Thanos\' actions and restore balance to the universe.',
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
        'Peter Parker\'s identity is revealed, forcing him to seek help from Doctor Strange.',
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

  const movies = [movie1, movie2, movie3];
  const screens = [screen1, screen2, screen3, screen4];

  for (const movie of movies) {
    for (let day = 0; day < 3; day++) {
      for (const screen of screens) {
        // Showtimes: 10:00, 13:00, 16:00, 19:00, 22:00
        const hours = [10, 13, 16, 19, 22];
        for (const hour of hours) {
          const startTime = new Date(today);
          startTime.setDate(startTime.getDate() + day);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + movie.durationMinutes);

          const isPast = startTime < now;
          const isFarFuture = day >= 2;

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
  console.log('\n📧 Admin login: admin@cinema.com / Admin123!');
  console.log('📧 User login:  user@cinema.com / User123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
