#!/bin/bash
# Mark failed migration as resolved and reapply
npx prisma migrate resolve --applied 20260208041225_complete_schema || true
npx prisma migrate deploy
