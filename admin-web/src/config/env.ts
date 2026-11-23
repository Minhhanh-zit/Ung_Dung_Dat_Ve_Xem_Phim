// Linear-time trimming avoids potentially super-linear regex backtracking.
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end--;
  return value.slice(0, end);
}

export const API_BASE_URL: string = stripTrailingSlashes(
  import.meta.env.VITE_API_BASE_URL || '/api',
);

export default API_BASE_URL;
