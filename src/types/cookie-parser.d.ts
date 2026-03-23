// Fallback declaration for cookie-parser when @types/cookie-parser
// is not resolved (e.g., CI caching issues). Prefer the real types
// from @types/cookie-parser when available.
declare module "cookie-parser" {
  import { RequestHandler } from "express";
  function cookieParser(
    secret?: string | string[],
    options?: cookieParser.CookieParseOptions,
  ): RequestHandler;
  namespace cookieParser {
    interface CookieParseOptions {
      decode?: (val: string) => string;
    }
  }
  export = cookieParser;
}
