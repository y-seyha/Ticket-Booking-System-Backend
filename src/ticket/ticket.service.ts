import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateQrCode(): string {
    return 'TKT-' + crypto.randomBytes(6).toString('base64url').slice(0, 8);
  }

  async generateTicketsForBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSeats: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Booking must be CONFIRMED to generate tickets',
      );
    }

    const existing = await this.prisma.ticket.findFirst({
      where: { bookingId },
    });

    if (existing) {
      this.logger.warn(`Tickets already exist for booking ${bookingId}`);
      return;
    }

    const ticketsData = booking.bookingSeats.map((bs) => ({
      bookingId: booking.id,
      bookingSeatId: bs.id,
      accountId: booking.accountId,
      qrCode: this.generateQrCode(),
    }));

    await this.prisma.ticket.createMany({
      data: ticketsData,
    });

    this.logger.log(
      `Generated ${ticketsData.length} tickets for booking ${bookingId}`,
    );
  }

  async getUserTickets(accountId: string, status?: TicketStatus) {
    const where: Prisma.TicketWhereInput = { accountId };

    if (status) {
      where.status = status;
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        booking: {
          include: {
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getTicketsByBooking(bookingId: string, accountId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { bookingId, accountId },
      include: {
        booking: {
          include: {
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!tickets.length) {
      throw new NotFoundException('No tickets found for this booking');
    }

    return tickets;
  }

  async getTicketById(ticketId: string, accountId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        booking: {
          include: {
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.accountId !== accountId) {
      throw new ForbiddenException('Ticket does not belong to this user');
    }

    return ticket;
  }

  async lookupByQrCode(qrCode: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        booking: {
          include: {
            account: {
              include: {
                profile: true,
              },
            },
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async validateTicket(qrCode: string, cashierId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        booking: {
          include: {
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === TicketStatus.USED) {
      throw new BadRequestException(
        `Ticket already used at ${ticket.validatedAt?.toISOString()}`,
      );
    }

    if (ticket.status === TicketStatus.REFUNDED) {
      throw new BadRequestException('Ticket has been refunded');
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      throw new BadRequestException('Ticket has expired');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.USED,
        validatedAt: new Date(),
        validatedBy: cashierId,
      },
      include: {
        booking: {
          include: {
            account: {
              include: {
                profile: true,
              },
            },
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
    });

    this.logger.log(
      `Ticket ${ticket.qrCode} validated by cashier ${cashierId}`,
    );

    return updated;
  }

  async refundTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === TicketStatus.REFUNDED) {
      throw new BadRequestException('Ticket already refunded');
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      throw new BadRequestException('Cannot refund an expired ticket');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.REFUNDED,
      },
    });

    this.logger.log(`Ticket ${ticket.qrCode} refunded`);

    return updated;
  }

  async getCashierOrders(filters: {
    startDate?: Date;
    endDate?: Date;
    movieTitle?: string;
  }) {
    const where: Prisma.BookingWhereInput = {
      status: 'CONFIRMED',
    };

    if (filters.movieTitle) {
      where.showtime = {
        movie: {
          title: {
            contains: filters.movieTitle,
            mode: 'insensitive',
          },
        },
      };
    }

    if (filters.startDate || filters.endDate) {
      where.showtime = {
        ...(where.showtime as object),
        startTime: {
          ...(filters.startDate ? { gte: filters.startDate } : {}),
          ...(filters.endDate ? { lte: filters.endDate } : {}),
        },
      };
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        account: {
          include: {
            profile: true,
          },
        },
        showtime: {
          include: {
            movie: true,
            screen: {
              include: {
                theater: true,
              },
            },
          },
        },
        bookingSeats: {
          include: {
            seat: true,
            ticket: true,
          },
        },
        foodItems: {
          include: { foodItem: true },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllTickets(status?: TicketStatus) {
    const where: Prisma.TicketWhereInput = {};

    if (status) {
      where.status = status;
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        booking: {
          include: {
            account: {
              include: {
                profile: true,
              },
            },
            showtime: {
              include: {
                movie: true,
                screen: {
                  include: {
                    theater: true,
                  },
                },
              },
            },
            foodItems: {
              include: { foodItem: true },
            },
          },
        },
        bookingSeat: {
          include: {
            seat: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
