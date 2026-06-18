import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {Role, ShowtimeStatus} from '@prisma/client';

import { ShowtimeService } from './showtime.service';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';

@ApiTags('Showtimes')
@ApiBearerAuth()
@Controller('showtimes')
export class ShowtimeController {
    constructor(
        private readonly showtimeService: ShowtimeService,
    ) {}

    //done
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({summary: 'Create showtime',})
    @ApiResponse({status: 201, description: 'Showtime created successfully',})
    create(@Body() dto: CreateShowtimeDto) {
        return this.showtimeService.create(dto);
    }


    //done
    @Get()
    @ApiOperation({summary: 'Get all showtimes',})
    findAll() {
        return this.showtimeService.findAll();
    }

    //done
    @Get('movie/:movieId')
    @ApiOperation({summary: 'Get showtimes by movie',})
    findByMovie(
        @Param('movieId') movieId: string,
    ) {
        return this.showtimeService.findByMovie(movieId);
    }

    //done
    @Get('screen/:screenId')
    @ApiOperation({summary: 'Get showtimes by screen',})
    findByScreen(
        @Param('screenId') screenId: string,
    ) {
        return this.showtimeService.findByScreen(screenId);
    }

    //done
    @Get(':id')
    @ApiOperation({summary: 'Get showtime by id',})
    findOne(@Param('id') id: string,) {
        return this.showtimeService.findOne(id);
    }

    //done
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({summary: 'Update showtime'})
    update(@Param('id') id: string, @Body() dto: UpdateShowtimeDto,
    ) {
        return this.showtimeService.update(id, dto);
    }

    @Patch(':id/status')
    @ApiOperation({summary: 'Update showtime status',})
    @ApiResponse({status: 200, description: 'Showtime status updated successfully',})
    async updateStatus(@Param('id') id: string, @Body('status') status: ShowtimeStatus,) {
        return this.showtimeService.updateStatus(id, status,);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({summary: 'Delete showtime',})
    remove(
        @Param('id') id: string,
    ) {
        return this.showtimeService.remove(id);
    }
}