import { Injectable } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ReportType } from './dto/analytics-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly dashboardService: DashboardService) {}

  async exportCsv(params: {
    type: ReportType;
    from?: string;
    to?: string;
    groupBy?: string;
  }): Promise<{ filename: string; csv: string }> {
    switch (params.type) {
      case ReportType.REVENUE:
        return this.exportRevenueCsv(params.from, params.to, params.groupBy);
      case ReportType.BOOKINGS:
        return this.exportBookingsCsv(params.from, params.to);
      case ReportType.USERS:
        return this.exportUsersCsv(params.from, params.to);
      case ReportType.MOVIES:
        return this.exportMoviesCsv(params.from, params.to);
      case ReportType.FOOD_BEVERAGE:
        return this.exportFoodBeverageCsv(params.from, params.to);
      case ReportType.OCCUPANCY:
        return this.exportOccupancyCsv(params.from, params.to);
      default:
        return { filename: 'report.csv', csv: '' };
    }
  }

  private async exportRevenueCsv(from?: string, to?: string, groupBy?: string) {
    const data = await this.dashboardService.getRevenueData(from, to, groupBy);
    const headers = 'Date,Revenue,Ticket Revenue,Food Revenue,Transactions\n';
    const rows = data.dataPoints
      .map(
        (d) =>
          `${d.date},${d.revenue},${d.ticketRevenue},${d.foodRevenue},${d.count}`,
      )
      .join('\n');
    return {
      filename: `revenue-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: headers + rows,
    };
  }

  private async exportBookingsCsv(from?: string, to?: string) {
    const data = await this.dashboardService.getBookingStats(from, to);
    const headers = 'Date,Total,Confirmed,Cancelled,Pending,Expired\n';
    const rows = data.byDay
      .map(
        (d) =>
          `${d.date},${d.total},${d.confirmed},${d.cancelled},${d.pending},${d.expired}`,
      )
      .join('\n');
    return {
      filename: `bookings-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: headers + rows,
    };
  }

  private async exportUsersCsv(from?: string, to?: string) {
    const data = await this.dashboardService.getUserStats(from, to);
    const headers = 'Date,Registrations\n';
    const rows = data.registrations
      .map((d) => `${d.date},${d.count}`)
      .join('\n');
    return {
      filename: `users-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: headers + rows,
    };
  }

  private async exportMoviesCsv(from?: string, to?: string) {
    const data = await this.dashboardService.getMoviePerformance(from, to);
    const headers =
      'Movie,Language,Status,Showtimes,Bookings,Revenue,Seats Sold,Avg Revenue/Booking\n';
    const rows = data
      .map(
        (m) =>
          `"${m.title}",${m.language},${m.status},${m.totalShowtimes},${m.totalBookings},${m.totalRevenue},${m.totalSeatsSold},${m.avgRevenuePerBooking}`,
      )
      .join('\n');
    return {
      filename: `movies-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: headers + rows,
    };
  }

  private async exportFoodBeverageCsv(from?: string, to?: string) {
    const data = await this.dashboardService.getFoodBeverageStats(from, to);
    const headers = 'Item,Category,Quantity Sold,Revenue\n';
    const rows = data.topItems
      .map((d) => `"${d.name}","${d.category}",${d.quantity},${d.revenue}`)
      .join('\n');
    return {
      filename: `food-beverage-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: headers + rows,
    };
  }

  private async exportOccupancyCsv(from?: string, to?: string) {
    const data = await this.dashboardService.getOccupancyData(from, to);
    const rows: string[] = [];

    rows.push('=== Overall ===');
    rows.push(`Capacity,Occupied,Occupancy Rate %,Showtimes`);
    rows.push(
      `${data.overall.totalCapacity},${data.overall.totalOccupied},${data.overall.occupancyRate},${data.overall.totalShowtimes}`,
    );
    rows.push('');
    rows.push('=== By Movie ===');
    rows.push('Movie,Capacity,Occupied,Occupancy Rate %,Showtimes');
    data.byMovie.forEach((m) =>
      rows.push(
        `"${m.title}",${m.capacity},${m.occupied},${m.occupancyRate},${m.showtimes}`,
      ),
    );

    return {
      filename: `occupancy-report-${from || 'all'}-${to || 'now'}.csv`,
      csv: rows.join('\n'),
    };
  }
}
