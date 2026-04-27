-- Add 'paused' to production_status enum
ALTER TYPE "public"."production_status" ADD VALUE 'paused';
