import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import {
  addDays,
  startOfDay,
  endOfDay,
  subDays,
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

interface GroupByConfig {
  day?: Date;
  week?: Date;
  month?: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *')
  async generateDailySnapshot() {
    const yesterday = subDays(new Date(), 1);
    const dayStart = startOfDay(yesterday);
    const dayEnd = endOfDay(yesterday);

    try {
      const [
        revenueResult,
        bookingCounts,
        userCounts,
        movieCount,
        showtimeCount,
      ] = await Promise.all([
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.SUCCESS,
            paidAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        this.prisma.booking.groupBy({
          by: ['status'],
          where: {
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _count: true,
        }),
        Promise.all([
          this.prisma.account.count(),
          this.prisma.account.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          }),
        ]),
        this.prisma.movie.count(),
        this.prisma.showtime.count({
          where: { startTime: { gte: dayStart, lte: dayEnd } },
        }),
      ]);

      const totalRevenue = revenueResult._sum.amount?.toNumber() || 0;
      const totalBookings = bookingCounts.reduce((sum, b) => sum + b._count, 0);
      const confirmed =
        bookingCounts.find((b) => b.status === 'CONFIRMED')?._count || 0;
      const cancelled =
        bookingCounts.find((b) => b.status === 'CANCELLED')?._count || 0;
      const expired =
        bookingCounts.find((b) => b.status === 'EXPIRED')?._count || 0;
      const [totalUsers, newUsers] = userCounts;

      const foodRevenue = await this.getFoodRevenue(dayStart, dayEnd);
      const ticketRevenue = totalRevenue - foodRevenue;

      await this.prisma.dashboardSnapshot.upsert({
        where: { date: dayStart },
        update: {
          totalRevenue,
          ticketRevenue,
          foodRevenue,
          totalBookings,
          confirmedBookings: confirmed,
          cancelledBookings: cancelled,
          expiredBookings: expired,
          totalUsers,
          newUsers,
          totalMovies: movieCount,
          totalShowtimes: showtimeCount,
          avgOccupancyRate: await this.calculateAvgOccupancy(dayStart, dayEnd),
        },
        create: {
          date: dayStart,
          totalRevenue,
          ticketRevenue,
          foodRevenue,
          totalBookings,
          confirmedBookings: confirmed,
          cancelledBookings: cancelled,
          expiredBookings: expired,
          totalUsers,
          newUsers,
          totalMovies: movieCount,
          totalShowtimes: showtimeCount,
          avgOccupancyRate: await this.calculateAvgOccupancy(dayStart, dayEnd),
        },
      });

      this.logger.log(
        `Dashboard snapshot generated for ${format(dayStart, 'yyyy-MM-dd')}`,
      );
    } catch (error) {
      this.logger.error('Failed to generate daily snapshot', error);
    }
  }

  async getSummary() {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const thisMonthStart = startOfMonth(new Date());
    const lastMonthStart = startOfMonth(subDays(new Date(), 30));

    const [
      todayRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      bookingStats,
      userCount,
      lastMonthUsers,
      movieStats,
      recentSnapshots,
      foodRevenueToday,
    ] = await Promise.all([
      this.getRevenue(today, todayEnd),
      this.getRevenue(thisMonthStart, todayEnd),
      this.getRevenue(lastMonthStart, today),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.account.count(),
      this.prisma.account.count({
        where: { createdAt: { gte: lastMonthStart, lte: today } },
      }),
      this.prisma.movie.count({
        where: { status: 'NOW_SHOWING' },
      }),
      this.prisma.dashboardSnapshot.findMany({
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.getFoodRevenue(today, todayEnd),
    ]);

    const totalBookings = bookingStats.reduce((sum, b) => sum + b._count, 0);
    const confirmedBookings =
      bookingStats.find((b) => b.status === 'CONFIRMED')?._count || 0;

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    const avgOccupancy =
      recentSnapshots.length > 0
        ? recentSnapshots.reduce((sum, s) => sum + s.avgOccupancyRate, 0) /
          recentSnapshots.length
        : await this.calculateAvgOccupancy(subDays(new Date(), 7), new Date());

    const topMovie = await this.getTopMovie();

    return {
      revenueToday: { value: todayRevenue, currency: 'USD' },
      revenueThisMonth: { value: thisMonthRevenue, currency: 'USD' },
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      totalBookings,
      confirmedBookings,
      cancelledBookings:
        bookingStats.find((b) => b.status === 'CANCELLED')?._count || 0,
      pendingBookings:
        bookingStats.find((b) => b.status === 'PENDING')?._count || 0,
      totalUsers: userCount,
      newUsersThisMonth: lastMonthUsers,
      activeMovies: movieStats,
      avgOccupancyRate: Number(avgOccupancy.toFixed(1)),
      foodRevenueToday: { value: foodRevenueToday, currency: 'USD' },
      topMovie: topMovie || null,
    };
  }

  async getRevenueData(from?: string, to?: string, groupBy?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);
    const grouping = groupBy || 'day';

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: { gte: f, lte: t },
      },
      include: {
        booking: {
          include: {
            showtime: {
              include: { movie: true, screen: { include: { theater: true } } },
            },
            foodItems: true,
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    const grouped = new Map<
      string,
      {
        revenue: number;
        ticketRevenue: number;
        foodRevenue: number;
        count: number;
      }
    >();

    for (const payment of payments) {
      let key: string;
      const d = payment.paidAt!;
      if (grouping === 'week') {
        const wkStart = startOfWeek(d, { weekStartsOn: 1 });
        key = format(wkStart, 'yyyy-MM-dd');
      } else if (grouping === 'month') {
        key = format(d, 'yyyy-MM');
      } else if (grouping === 'year') {
        key = format(d, 'yyyy');
      } else {
        key = format(d, 'yyyy-MM-dd');
      }

      const amount = payment.amount.toNumber();
      const foodTotal =
        payment.booking?.foodItems?.reduce(
          (sum, fi) => sum + fi.unitPrice.toNumber() * fi.quantity,
          0,
        ) || 0;

      const entry = grouped.get(key) || {
        revenue: 0,
        ticketRevenue: 0,
        foodRevenue: 0,
        count: 0,
      };
      entry.revenue += amount;
      entry.ticketRevenue += amount - foodTotal;
      entry.foodRevenue += foodTotal;
      entry.count++;
      grouped.set(key, entry);
    }

    return {
      groupBy: grouping,
      dataPoints: Array.from(grouped.entries()).map(([date, data]) => ({
        date,
        ...data,
        revenue: Number(data.revenue.toFixed(2)),
        ticketRevenue: Number(data.ticketRevenue.toFixed(2)),
        foodRevenue: Number(data.foodRevenue.toFixed(2)),
      })),
    };
  }

  async getBookingStats(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const [byStatus, byDay, stats] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { createdAt: { gte: f, lte: t } },
        _count: true,
      }),
      this.getBookingsByDay(f, t),
      this.prisma.booking.aggregate({
        where: { createdAt: { gte: f, lte: t } },
        _avg: { totalPrice: true },
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      byDay,
      avgTicketPrice: Number(
        stats._avg.totalPrice?.toNumber()?.toFixed(2) || 0,
      ),
      totalRevenue: Number(stats._sum.totalPrice?.toNumber()?.toFixed(2) || 0),
    };
  }

  async getUserStats(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const [byRole, registrations, activeUsers] = await Promise.all([
      this.prisma.account.groupBy({
        by: ['role'],
        _count: true,
      }),
      this.getRegistrationsByDay(f, t),
      this.prisma.account.count({
        where: { lastLoginAt: { gte: subDays(new Date(), 30) } },
      }),
    ]);

    return {
      byRole: byRole.map((r) => ({
        role: r.role,
        count: r._count,
      })),
      registrations,
      activeUsersLast30Days: activeUsers,
    };
  }

  async getMoviePerformance(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const movies = await this.prisma.movie.findMany({
      include: {
        showtimes: {
          where: { startTime: { gte: f, lte: t } },
          include: {
            bookings: {
              where: { status: BookingStatus.CONFIRMED },
              include: {
                bookingSeats: true,
                payment: true,
              },
            },
          },
        },
      },
    });

    return movies
      .map((movie) => {
        const bookings = movie.showtimes.flatMap((s) => s.bookings);
        const totalRevenue = bookings.reduce(
          (sum, b) => sum + (b.payment?.amount.toNumber() || 0),
          0,
        );
        const totalSeatsSold = bookings.reduce(
          (sum, b) => sum + b.bookingSeats.length,
          0,
        );
        return {
          id: movie.id,
          title: movie.title,
          language: movie.language,
          status: movie.status,
          totalShowtimes: movie.showtimes.length,
          totalBookings: bookings.length,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalSeatsSold,
          avgRevenuePerBooking:
            bookings.length > 0
              ? Number((totalRevenue / bookings.length).toFixed(2))
              : 0,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async getFoodBeverageStats(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const items = await this.prisma.bookingFoodItem.findMany({
      where: {
        booking: { createdAt: { gte: f, lte: t } },
      },
      include: {
        foodItem: {
          include: { category: true },
        },
      },
    });

    const byItem = new Map<
      string,
      { name: string; category: string; quantity: number; revenue: number }
    >();
    const byCategory = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    for (const item of items) {
      const revenue = item.unitPrice.toNumber() * item.quantity;

      const itemEntry = byItem.get(item.foodItemId) || {
        name: item.foodItem.name,
        category: item.foodItem.category.name,
        quantity: 0,
        revenue: 0,
      };
      itemEntry.quantity += item.quantity;
      itemEntry.revenue += revenue;
      byItem.set(item.foodItemId, itemEntry);

      const catEntry = byCategory.get(item.foodItem.categoryId) || {
        name: item.foodItem.category.name,
        quantity: 0,
        revenue: 0,
      };
      catEntry.quantity += item.quantity;
      catEntry.revenue += revenue;
      byCategory.set(item.foodItem.categoryId, catEntry);
    }

    return {
      totalItemsSold: items.length,
      totalRevenue: Number(
        items
          .reduce((s, i) => s + i.unitPrice.toNumber() * i.quantity, 0)
          .toFixed(2),
      ),
      byCategory: Array.from(byCategory.entries()).map(([id, data]) => ({
        id,
        ...data,
        revenue: Number(data.revenue.toFixed(2)),
      })),
      topItems: Array.from(byItem.entries())
        .map(([id, data]) => ({
          id,
          ...data,
          revenue: Number(data.revenue.toFixed(2)),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
    };
  }

  async getOccupancyData(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const showtimes = await this.prisma.showtime.findMany({
      where: { startTime: { gte: f, lte: t } },
      include: {
        screen: {
          include: {
            theater: true,
            seats: { where: { status: 'ACTIVE' } },
          },
        },
        bookingSeats: {
          where: {
            booking: {
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            },
          },
        },
        movie: true,
      },
    });

    const totalCapacity = showtimes.reduce(
      (sum, s) => sum + s.screen.seats.length,
      0,
    );
    const totalOccupied = showtimes.reduce(
      (sum, s) => sum + s.bookingSeats.length,
      0,
    );

    const byMovie = new Map<
      string,
      { title: string; capacity: number; occupied: number; showtimes: number }
    >();
    const byTheater = new Map<
      string,
      {
        name: string;
        city: string;
        capacity: number;
        occupied: number;
        showtimes: number;
      }
    >();
    const byHour = new Map<
      number,
      { hour: number; capacity: number; occupied: number; showtimes: number }
    >();

    for (const st of showtimes) {
      const cap = st.screen.seats.length;
      const occ = st.bookingSeats.length;

      const movieEntry = byMovie.get(st.movieId) || {
        title: st.movie.title,
        capacity: 0,
        occupied: 0,
        showtimes: 0,
      };
      movieEntry.capacity += cap;
      movieEntry.occupied += occ;
      movieEntry.showtimes++;
      byMovie.set(st.movieId, movieEntry);

      const theaterEntry = byTheater.get(st.screen.theaterId) || {
        name: st.screen.theater.name,
        city: st.screen.theater.city,
        capacity: 0,
        occupied: 0,
        showtimes: 0,
      };
      theaterEntry.capacity += cap;
      theaterEntry.occupied += occ;
      theaterEntry.showtimes++;
      byTheater.set(st.screen.theaterId, theaterEntry);

      const hour = st.startTime.getHours();
      const hourEntry = byHour.get(hour) || {
        hour,
        capacity: 0,
        occupied: 0,
        showtimes: 0,
      };
      hourEntry.capacity += cap;
      hourEntry.occupied += occ;
      hourEntry.showtimes++;
      byHour.set(hour, hourEntry);
    }

    return {
      overall: {
        totalCapacity,
        totalOccupied,
        occupancyRate:
          totalCapacity > 0
            ? Number(((totalOccupied / totalCapacity) * 100).toFixed(1))
            : 0,
        totalShowtimes: showtimes.length,
      },
      byMovie: Array.from(byMovie.entries())
        .map(([id, d]) => ({
          id,
          ...d,
          occupancyRate:
            d.capacity > 0
              ? Number(((d.occupied / d.capacity) * 100).toFixed(1))
              : 0,
        }))
        .sort((a, b) => b.occupancyRate - a.occupancyRate),
      byTheater: Array.from(byTheater.entries())
        .map(([id, d]) => ({
          id,
          ...d,
          occupancyRate:
            d.capacity > 0
              ? Number(((d.occupied / d.capacity) * 100).toFixed(1))
              : 0,
        }))
        .sort((a, b) => b.occupancyRate - a.occupancyRate),
      byHour: Array.from(byHour.entries())
        .map(([_, d]) => ({
          ...d,
          occupancyRate:
            d.capacity > 0
              ? Number(((d.occupied / d.capacity) * 100).toFixed(1))
              : 0,
        }))
        .sort((a, b) => a.hour - b.hour),
    };
  }

  async getPeakTimes(from?: string, to?: string) {
    const { from: f, to: t } = this.parseDateRange(from, to);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        createdAt: { gte: f, lte: t },
      },
      select: { createdAt: true },
    });

    const byHour = new Map<number, number>();
    const byDayOfWeek = new Map<number, number>();
    const byDate = new Map<string, number>();

    for (const b of bookings) {
      const hour = b.createdAt.getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);

      const dow = b.createdAt.getDay();
      byDayOfWeek.set(dow, (byDayOfWeek.get(dow) || 0) + 1);

      const dateKey = format(b.createdAt, 'yyyy-MM-dd');
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    return {
      byHour: Array.from(byHour.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour),
      byDayOfWeek: Array.from(byDayOfWeek.entries())
        .map(([day, count]) => ({ day: dayNames[day], dayIndex: day, count }))
        .sort((a, b) => a.dayIndex - b.dayIndex),
      peakHour:
        Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 0,
      peakDay:
        Array.from(byDayOfWeek.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        0,
      totalBookings: bookings.length,
    };
  }

  private async getTopMovie() {
    const movies = await this.prisma.movie.findMany({
      where: { status: 'NOW_SHOWING' },
      include: {
        showtimes: {
          include: {
            bookings: {
              where: { status: BookingStatus.CONFIRMED },
              include: { payment: true },
            },
          },
        },
      },
    });

    let topMovie: {
      id: string;
      title: string;
      revenue: number;
      bookings: number;
    } | null = null;

    for (const movie of movies) {
      const bookings = movie.showtimes.flatMap((s) => s.bookings);
      const revenue = bookings.reduce(
        (sum, b) => sum + (b.payment?.amount.toNumber() || 0),
        0,
      );
      if (!topMovie || revenue > topMovie.revenue) {
        topMovie = {
          id: movie.id,
          title: movie.title,
          revenue: Number(revenue.toFixed(2)),
          bookings: bookings.length,
        };
      }
    }

    return topMovie;
  }

  private async calculateAvgOccupancy(from: Date, to: Date): Promise<number> {
    const showtimes = await this.prisma.showtime.findMany({
      where: { startTime: { gte: from, lte: to } },
      include: {
        screen: { include: { seats: { where: { status: 'ACTIVE' } } } },
        bookingSeats: {
          where: {
            booking: {
              status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
            },
          },
        },
      },
    });

    if (showtimes.length === 0) return 0;

    const totalRate = showtimes.reduce((sum, st) => {
      const cap = st.screen.seats.length;
      if (cap === 0) return sum;
      return sum + st.bookingSeats.length / cap;
    }, 0);

    return Number(((totalRate / showtimes.length) * 100).toFixed(1));
  }

  private async getRevenue(from: Date, to: Date): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.SUCCESS,
        paidAt: { gte: from, lte: to },
      },
    });
    return result._sum.amount?.toNumber() || 0;
  }

  private async getFoodRevenue(from: Date, to: Date): Promise<number> {
    const items = await this.prisma.bookingFoodItem.findMany({
      where: {
        booking: {
          createdAt: { gte: from, lte: to },
        },
      },
    });
    return items.reduce(
      (sum, i) => sum + i.unitPrice.toNumber() * i.quantity,
      0,
    );
  }

  private async getBookingsByDay(from: Date, to: Date) {
    const bookings = await this.prisma.booking.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<
      string,
      {
        date: string;
        total: number;
        confirmed: number;
        cancelled: number;
        pending: number;
        expired: number;
      }
    >();

    for (const b of bookings) {
      const key = format(b.createdAt, 'yyyy-MM-dd');
      const entry = byDay.get(key) || {
        date: key,
        total: 0,
        confirmed: 0,
        cancelled: 0,
        pending: 0,
        expired: 0,
      };
      entry.total++;
      if (b.status === 'CONFIRMED') entry.confirmed++;
      else if (b.status === 'CANCELLED') entry.cancelled++;
      else if (b.status === 'PENDING') entry.pending++;
      else if (b.status === 'EXPIRED') entry.expired++;
      byDay.set(key, entry);
    }

    return Array.from(byDay.values());
  }

  private async getRegistrationsByDay(from: Date, to: Date) {
    const accounts = await this.prisma.account.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, number>();
    for (const a of accounts) {
      const key = format(a.createdAt, 'yyyy-MM-dd');
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }

    return Array.from(byDay.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  private parseDateRange(from?: string, to?: string): DateRange {
    const f = from ? new Date(from) : subDays(new Date(), 30);
    const t = to ? new Date(to) : new Date();
    return {
      from: startOfDay(f),
      to: endOfDay(t),
    };
  }
}
