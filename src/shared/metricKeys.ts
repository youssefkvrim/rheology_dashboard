// basically the master list of metric names in french and their database equivalents
// french side is what u see in the app, db side is what sql server actually stores
// densite <-> density, viscosite <-> viscosity, ph <-> pH, etc. u get the idea

// the french metric names we use everywhere in the frontend
export type FrontendMetricKey =
  | 'densite'
  | 'viscosite'
  | 'ph'
  | 'temperature'
  | 'pc'
  | 'h2o'
  | 'silice'
  | 'grains';

// the english-ish names the database actually uses
export type DbMetricKey =
  | 'density'
  | 'viscosity'
  | 'pH'
  | 'temperature'
  | 'pc'
  | 'H2O'
  | 'silice'
  | 'grain';

// u give me a french key, i give u the database key. simple.
export const FRONTEND_TO_DB: Record<FrontendMetricKey, DbMetricKey> = {
  densite: 'density',
  viscosite: 'viscosity',
  ph: 'pH',
  temperature: 'temperature',
  pc: 'pc',
  h2o: 'H2O',
  silice: 'silice',
  grains: 'grain',
};

// same thing but reversed — db key in, french key out. we just flip the other map lol
export const DB_TO_FRONTEND: Record<DbMetricKey, FrontendMetricKey> = Object.fromEntries(
  Object.entries(FRONTEND_TO_DB).map(([fe, db]) => [db, fe])
) as Record<DbMetricKey, FrontendMetricKey>;

// quick helper: french -> db
export function toDbKey(frontendKey: FrontendMetricKey): DbMetricKey {
  return FRONTEND_TO_DB[frontendKey];
}

// quick helper: db -> french. if it doesnt know the key it just lowercases it and hopes for the best
export function toFeKey(dbKey: string): FrontendMetricKey {
  return (DB_TO_FRONTEND as Record<string, FrontendMetricKey>)[dbKey]
    ?? (String(dbKey).toLowerCase() as FrontendMetricKey);
}

// handy arrays if u ever need to loop over all the keys
export const ALL_FRONTEND_KEYS: FrontendMetricKey[] = Object.keys(FRONTEND_TO_DB) as FrontendMetricKey[];
export const ALL_DB_KEYS: DbMetricKey[] = Object.values(FRONTEND_TO_DB);
