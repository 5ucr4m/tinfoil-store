import { decrypt } from "../crypto";
import { db } from "../db";
import { GDriveDriver, type GDriveConfig } from "./gdrive";
import { LocalDriver, type LocalConfig } from "./local";
import { S3Driver, type S3Config } from "./s3";
import type { Driver, IntegrationType } from "./types";

export interface IntegrationRow {
  id: string;
  type: IntegrationType;
  name: string;
  config: string;
  status: string;
  status_detail: string | null;
  last_sync_at: number | null;
  created_at: number;
}

const cache = new Map<string, { config: string; driver: Driver }>();

export function getIntegration(id: string) {
  return db.prepare("SELECT * FROM integrations WHERE id = ?").get(id) as IntegrationRow | undefined;
}

export function driverFor(row: IntegrationRow): Driver {
  const hit = cache.get(row.id);
  if (hit && hit.config === row.config) return hit.driver;

  let driver: Driver;
  switch (row.type) {
    case "local":
      driver = new LocalDriver(decrypt<LocalConfig>(row.config));
      break;
    case "s3":
      driver = new S3Driver(decrypt<S3Config>(row.config));
      break;
    case "gdrive":
      driver = new GDriveDriver(row.id, decrypt<GDriveConfig>(row.config));
      break;
    default:
      throw new Error(`Tipo de integração desconhecido: ${row.type}`);
  }
  cache.set(row.id, { config: row.config, driver });
  return driver;
}

export function forgetDriver(id: string) {
  cache.delete(id);
}
