import type { ClientConfig } from 'pg';

/**
 * RDS/AWS costuma exigir TLS. OLD_DATABASE_SSL=disable força off;
 * OLD_DATABASE_SSL=no-verify ignora validação do certificado.
 */
export function oldDatabasePgConfig(connectionString: string): ClientConfig {
  const flag = process.env.OLD_DATABASE_SSL?.toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'disable') {
    return { connectionString };
  }

  const urlSuggestsSsl =
    /[?&]sslmode=(require|verify-full)/i.test(connectionString) ||
    /[?&]ssl=true/i.test(connectionString);

  const hostLooksLikeRds = connectionString.includes('rds.amazonaws.com');

  const needSsl =
    flag === 'require' ||
    flag === 'true' ||
    flag === '1' ||
    flag === 'no-verify' ||
    urlSuggestsSsl ||
    hostLooksLikeRds;

  if (!needSsl) {
    return { connectionString };
  }

  if (flag === 'no-verify' || /[?&]sslmode=no-verify/i.test(connectionString)) {
    return {
      connectionString,
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    connectionString,
    ssl: { rejectUnauthorized: true },
  };
}
