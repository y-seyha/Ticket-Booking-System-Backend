import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search movies and theaters' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Result limit' })
  async search(
    @Query(new ValidationPipe({ transform: true })) query: SearchQueryDto,
  ) {
    return this.searchService.search(query.q, query.limit ?? 10);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  async autocomplete(@Query('q') q: string) {
    return this.searchService.autocomplete(q);
  }
}
