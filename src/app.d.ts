// See https://kit.svelte.dev/docs/types#app

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Error {
      message: string;
      code?: string;
    }
    interface Locals {
      user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
      } | null;
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
        BUCKET?: R2Bucket;  // Optional - using D1 file_storage instead
        GROQ_API_KEY: string;
        JWT_SECRET: string;
        APP_NAME?: string;
      };
      cf: CfProperties;
      ctx: ExecutionContext;
    }
  }
}

export {};
