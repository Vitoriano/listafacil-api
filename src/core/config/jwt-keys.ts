import { ConfigService } from '@nestjs/config';

type JwtKeyKind = 'PRIVATE' | 'PUBLIC';

/**
 * Resolve a chave JWT (PEM) a partir da config, aceitando três formatos:
 *  - JWT_<KIND>_KEY_B64: PEM em base64 (recomendado em produção, evita multilinha no painel de env)
 *  - JWT_<KIND>_KEY com quebras de linha reais (arquivo .env local)
 *  - JWT_<KIND>_KEY com "\n" literal
 */
export function getJwtKey(config: ConfigService, kind: JwtKeyKind): string {
  const b64 = config.get<string>(`JWT_${kind}_KEY_B64`);
  if (b64?.trim()) {
    return Buffer.from(b64.trim(), 'base64').toString('utf8');
  }
  const raw = config.get<string>(`JWT_${kind}_KEY`, '');
  return raw.replace(/\\n/g, '\n');
}
