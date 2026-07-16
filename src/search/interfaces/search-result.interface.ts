export interface SearchMovieResult {
  id: string;
  title: string;
  poster: string | null;
  durationMinutes: number;
  language: string;
  status: string;
  releaseDate: string;
}

export interface SearchTheaterResult {
  id: string;
  name: string;
  location: string;
  city: string;
  status: string;
}

export interface SearchResult {
  movies: SearchMovieResult[];
  theaters: SearchTheaterResult[];
  total: number;
}

export interface AutocompleteResult {
  suggestions: Array<{
    text: string;
    type: 'movie' | 'theater';
    id: string;
  }>;
}
