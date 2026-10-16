import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm runs scripts from tests/, so a relative SITE_DIR is resolved against the folder npm was called from.
export const siteDir = process.env.SITE_DIR
  ? path.resolve(process.env.INIT_CWD || process.cwd(), process.env.SITE_DIR)
  : path.resolve(fileURLToPath(new URL('..', import.meta.url)));
