import { RequestHandler } from "express";
import rateLimit from "express-rate-limit";

/**
 * Rate limit middleware.
 * authLimiter: 5 req / 15 min — applied to /auth routes
 * emailActionLimiter: 20 req / 15 min — applied to email action routes
 * apiLimiter: 100 req / 15 min — applied to /api, /todos, /users, /ai, /projects
 * All limiters are bypassed when NODE_ENV=test.
 */
const isTest = process.env.NODE_ENV === "test";
const noLimit: RequestHandler = (_req, _res, next) => next();

export const authLimiter: RequestHandler = isTest
  ? noLimit
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: "Too many authentication attempts, please try again later",
      standardHeaders: true,
      legacyHeaders: false,
    });

export const emailActionLimiter: RequestHandler = isTest
  ? noLimit
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: "Too many email actions, please try again later",
      standardHeaders: true,
      legacyHeaders: false,
    });

export const apiLimiter: RequestHandler = isTest
  ? noLimit
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: "Too many requests, please try again later",
      standardHeaders: true,
      legacyHeaders: false,
    });
