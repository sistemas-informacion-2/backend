import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Utilidades de cifrado simetrico (AES-256-GCM) para credenciales sensibles
 * que deben persistirse en la base de datos, como las API keys de las
 * pasarelas de pago (CU16). El formato almacenado es `iv:authTag:ciphertext`
 * codificado en base64.
 */
function resolverClave(encryptionKey: string): Buffer {
  if (!encryptionKey) {
    throw new Error('PAGOS_ENCRYPTION_KEY no esta configurada');
  }

  const clave = /^[0-9a-fA-F]{64}$/.test(encryptionKey)
    ? Buffer.from(encryptionKey, 'hex')
    : Buffer.from(encryptionKey, 'base64');

  if (clave.length !== KEY_LENGTH) {
    throw new Error('La clave de cifrado debe tener 32 bytes (64 caracteres hex o base64 de 32 bytes)');
  }

  return clave;
}

export function encrypt(plain: string, encryptionKey: string): string {
  const clave = resolverClave(encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, clave, iv);
  const cifrado = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${cifrado.toString('base64')}`;
}

export function decrypt(payload: string, encryptionKey: string): string {
  const clave = resolverClave(encryptionKey);
  const [ivBase64, authTagBase64, datosBase64] = payload.split(':');

  if (!ivBase64 || !authTagBase64 || !datosBase64) {
    throw new Error('Formato de credencial cifrada invalido');
  }

  const decipher = createDecipheriv(ALGORITHM, clave, Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(datosBase64, 'base64')), decipher.final()]).toString('utf8');
}
