import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Client } from '@opensearch-project/opensearch';
import type {
  SearchResult,
  AutocompleteResult,
  SearchMovieResult,
  SearchTheaterResult,
} from './interfaces/search-result.interface';

const MOVIES_INDEX = 'movies';
const THEATERS_INDEX = 'theaters';

interface MovieDocument {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  language: string;
  status: string;
  poster: string | null;
  releaseDate: string;
}

interface TheaterDocument {
  id: string;
  name: string;
  location: string;
  city: string;
  status: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly ttlSeconds = 120;
  private client: Client | null = null;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    const node = this.config.get<string>('OPENSEARCH_URL');
    if (!node) {
      this.logger.warn(
        'OPENSEARCH_URL not set — search will fall back to database queries',
      );
      return;
    }

    const username = this.config.get<string>('OPENSEARCH_USERNAME') || '';
    const password = this.config.get<string>('OPENSEARCH_PASSWORD') || '';

    const auth = username && password ? { username, password } : undefined;

    this.client = new Client({
      node,
      auth,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await this.client.ping();
      this.logger.log('OpenSearch connected');

      await Promise.all([
        this.ensureIndex(MOVIES_INDEX, {
          settings: { number_of_shards: 1, number_of_replicas: 0 },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                  autocomplete: { type: 'search_as_you_type' },
                },
              },
              description: { type: 'text' },
              durationMinutes: { type: 'integer' },
              language: { type: 'keyword' },
              status: { type: 'keyword' },
              poster: { type: 'keyword', index: false },
              releaseDate: { type: 'date' },
            },
          },
        }),
        this.ensureIndex(THEATERS_INDEX, {
          settings: { number_of_shards: 1, number_of_replicas: 0 },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                  autocomplete: { type: 'search_as_you_type' },
                },
              },
              location: { type: 'text' },
              city: { type: 'keyword' },
              status: { type: 'keyword' },
            },
          },
        }),
      ]);

      this.enabled = true;
      this.logger.log('OpenSearch indices ready');
    } catch (err) {
      this.logger.error(
        'OpenSearch connection failed, falling back to DB search',
        err,
      );
      this.client = null;
    }
  }

  private async ensureIndex(name: string, body: Record<string, unknown>) {
    const exists = await this.client!.indices.exists({ index: name });
    if (!exists.body) {
      await this.client!.indices.create({ index: name, body });
    }
  }

  // --- Indexing ---

  async indexMovie(movie: {
    id: string;
    title: string;
    description?: string | null;
    durationMinutes: number;
    language: string;
    status: string;
    poster?: string | null;
    releaseDate: Date | string;
  }) {
    if (!this.enabled) return;
    const doc: MovieDocument = {
      id: movie.id,
      title: movie.title,
      description: movie.description ?? null,
      durationMinutes: movie.durationMinutes,
      language: movie.language,
      status: movie.status,
      poster: movie.poster ?? null,
      releaseDate: new Date(movie.releaseDate).toISOString(),
    };
    await this.client!.index({
      index: MOVIES_INDEX,
      id: movie.id,
      body: doc,
      refresh: 'false',
    }).catch((err) => this.logger.error('Failed to index movie', err));

    await this.invalidateAll();
  }

  async removeMovie(id: string) {
    if (!this.enabled) return;
    await this.client!.delete({
      index: MOVIES_INDEX,
      id,
    }).catch(() => {});

    await this.invalidateAll();
  }

  async indexTheater(theater: {
    id: string;
    name: string;
    location: string;
    city: string;
    status: string;
  }) {
    if (!this.enabled) return;
    const doc: TheaterDocument = {
      id: theater.id,
      name: theater.name,
      location: theater.location,
      city: theater.city,
      status: theater.status,
    };
    await this.client!.index({
      index: THEATERS_INDEX,
      id: theater.id,
      body: doc,
      refresh: 'false',
    }).catch((err) => this.logger.error('Failed to index theater', err));

    await this.invalidateAll();
  }

  async removeTheater(id: string) {
    if (!this.enabled) return;
    await this.client!.delete({
      index: THEATERS_INDEX,
      id,
    }).catch(() => {});

    await this.invalidateAll();
  }

  // --- Searching ---

  async search(query?: string, limit = 20): Promise<SearchResult> {
    return this.redisService.getOrSet(
      `search:q:${query ?? ''}:${limit}`,
      this.ttlSeconds,
      () => {
        if (this.enabled) {
          return this.searchOpenSearch(query, limit);
        }
        return this.searchDatabase(query, limit);
      },
    );
  }

  async autocomplete(query: string): Promise<AutocompleteResult> {
    return this.redisService.getOrSet(
      `search:ac:${query}`,
      this.ttlSeconds,
      () => {
        if (this.enabled) {
          return this.autocompleteOpenSearch(query);
        }
        return this.autocompleteDatabase(query);
      },
    );
  }

  private async searchOpenSearch(
    query: string | undefined,
    limit: number,
  ): Promise<SearchResult> {
    const must: Record<string, unknown>[] = [{ term: { status: 'ARCHIVED' } }];

    const searchBody: Record<string, unknown> = {
      query: {
        bool: {
          must_not: must,
        },
      },
      size: limit,
      sort: [{ releaseDate: { order: 'desc' } }],
    };

    if (query?.trim()) {
      (searchBody.query as any).bool.must = {
        multi_match: {
          query,
          fields: ['title^3', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      };
    }

    const movieRes = await this.client!.search({
      index: MOVIES_INDEX,
      body: searchBody,
    });

    const movies: SearchMovieResult[] = movieRes.body.hits.hits.map(
      (hit: { _source: MovieDocument }) => hit._source,
    );

    return { movies, theaters: [], total: movies.length };
  }

  private async autocompleteOpenSearch(
    query: string,
  ): Promise<AutocompleteResult> {
    const movieRes = await this.client!.search({
      index: MOVIES_INDEX,
      body: {
        query: {
          bool: {
            must: {
              multi_match: {
                query,
                fields: ['title.autocomplete^3', 'title'],
                type: 'bool_prefix',
              },
            },
            must_not: [{ term: { status: 'ARCHIVED' } }],
          },
        },
        size: 5,
        _source: ['id', 'title'],
      },
    });

    const suggestions: AutocompleteResult['suggestions'] =
      movieRes.body.hits.hits.map(
        (hit: { _source: { id: string; title: string } }) => ({
          text: hit._source.title,
          type: 'movie' as const,
          id: hit._source.id,
        }),
      );

    return { suggestions };
  }

  // --- Fallback database search ---

  private async searchDatabase(
    query: string | undefined,
    limit: number,
  ): Promise<SearchResult> {
    const where: Record<string, unknown> = {
      status: { not: 'ARCHIVED' },
    };

    if (query?.trim()) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    const movies = await this.prisma.movie.findMany({
      where: where as any,
      take: limit,
      orderBy: { releaseDate: 'desc' },
      include: { poster: true },
    });

    return {
      movies: movies.map((m) => ({
        id: m.id,
        title: m.title,
        poster: (m as any).poster?.url ?? null,
        durationMinutes: m.durationMinutes,
        language: m.language,
        status: m.status,
        releaseDate: m.releaseDate.toISOString(),
      })),
      theaters: [],
      total: movies.length,
    };
  }

  private async autocompleteDatabase(
    query: string,
  ): Promise<AutocompleteResult> {
    const movies = await this.prisma.movie.findMany({
      where: {
        title: { contains: query, mode: 'insensitive' },
        status: { not: 'ARCHIVED' },
      },
      take: 5,
      select: { id: true, title: true },
      orderBy: { releaseDate: 'desc' },
    });

    return {
      suggestions: movies.map((m) => ({
        text: m.title,
        type: 'movie' as const,
        id: m.id,
      })),
    };
  }

  private async invalidateAll() {
    await this.redisService.delPattern('search:*');
  }
}
