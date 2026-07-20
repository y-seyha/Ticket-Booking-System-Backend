import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function getThisWeekRange(): { monday: Date; sunday: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

async function main() {
  console.log('Fetching existing movies and screens...');

  const movies = await prisma.movie.findMany({
    where: { status: 'NOW_SHOWING' },
  });

  const screens = await prisma.screen.findMany({
    include: { theater: true },
  });

  if (movies.length === 0) {
    console.error('No NOW_SHOWING movies found. Seed movies first.');
    process.exit(1);
  }

  if (screens.length === 0) {
    console.error('No screens found. Seed theaters/screens first.');
    process.exit(1);
  }

  const { monday, sunday } = getThisWeekRange();

  console.log(`This week: ${monday.toDateString()} — ${sunday.toDateString()}`);
  console.log(`Movies: ${movies.map((m) => m.title).join(', ')}`);
  console.log(`Screens: ${screens.map((s) => `${s.theater.name} - ${s.name}`).join(', ')}`);

  const timeSlots = [10, 13, 16, 19, 22];
  const now = new Date();

  const showtimeData: Array<{
    movieId: string;
    screenId: string;
    startTime: Date;
    endTime: Date;
    basePrice: number;
    status: 'SCHEDULED' | 'FINISHED';
  }> = [];

  for (const movie of movies) {
    for (const screen of screens) {
      for (let day = 0; day < 7; day++) {
        for (const hour of timeSlots) {
          const startTime = new Date(monday);
          startTime.setDate(monday.getDate() + day);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + movie.durationMinutes);

          const basePrice = hour >= 19 ? 12.0 : 8.0;
          const status = endTime < now ? 'FINISHED' : 'SCHEDULED';

          showtimeData.push({
            movieId: movie.id,
            screenId: screen.id,
            startTime,
            endTime,
            basePrice,
            status,
          });
        }
      }
    }
  }

  console.log(`Clearing existing showtimes for this week (${monday.toDateString()} — ${sunday.toDateString()})...`);
  const deleted = await prisma.showtime.deleteMany({
    where: {
      startTime: { gte: monday, lte: sunday },
    },
  });
  console.log(`Deleted ${deleted.count} existing showtimes in this week range.`);

  console.log(`Inserting ${showtimeData.length} showtimes...`);

  await prisma.showtime.createMany({ data: showtimeData });

  const count = await prisma.showtime.count();
  console.log(`✅ Done! Total showtimes in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
