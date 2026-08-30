const path = require('path');

// No depender de process.cwd(): npm cambia el cwd al workspace al correr `npm test -w apps/api`,
// pero el .env vive en la raíz del monorepo (junto a docker-compose.yml).
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

// Sin valor por defecto seguro: si falta alguna, la app no debe arrancar.
// WEB_URL es la lista blanca de CORS: un default silencioso ahí sería un hueco de seguridad.
const REQUERIDAS = [
  'NODE_ENV',
  'WEB_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RUT_CIFRADO_KEY',
];

const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  throw new Error(`Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
}

const ENTORNOS_VALIDOS = ['development', 'test', 'production'];
if (!ENTORNOS_VALIDOS.includes(process.env.NODE_ENV)) {
  throw new Error(`NODE_ENV debe ser uno de ${ENTORNOS_VALIDOS.join(', ')}, no "${process.env.NODE_ENV}"`);
}

// Una clave corta ("1234") arrancaría igual y cifraría todos los RUT con una passphrase débil.
if (process.env.RUT_CIFRADO_KEY.length < 32) {
  throw new Error('RUT_CIFRADO_KEY debe tener al menos 32 caracteres.');
}

const puerto = Number(process.env.PORT) || 3000;
const esProduccion = process.env.NODE_ENV === 'production';

// Ley 21.719 (docs/03-seguridad.md): CV y perfil se eliminan tras esta inactividad, con aviso
// previo. RETENCION_CV_MESES ya estaba en .env/.env.example desde una fase anterior, sin que nada
// la leyera todavía — el default de acá replica el valor que ya traían (12), no uno nuevo.
const retencionCvMeses = Number(process.env.RETENCION_CV_MESES) || 12;
const retencionAvisoDias = Number(process.env.RETENCION_AVISO_DIAS) || 30;

// Sin esto, un valor negativo o mal puesto no fallaba al arrancar — solo se notaba la noche que la
// tarea de retención lo usara para decidir a quién borrar. Con retencionCvMeses negativo, todo el
// mundo calificaba para eliminarse en la primera corrida; con retencionAvisoDias mayor que el plazo
// total, el aviso nunca llegaba a tiempo (auditoría de Fase 7).
if (!Number.isInteger(retencionCvMeses) || retencionCvMeses <= 0) {
  throw new Error('RETENCION_CV_MESES debe ser un entero positivo.');
}
if (!Number.isInteger(retencionAvisoDias) || retencionAvisoDias <= 0) {
  throw new Error('RETENCION_AVISO_DIAS debe ser un entero positivo.');
}
if (retencionAvisoDias >= retencionCvMeses * 28) {
  throw new Error('RETENCION_AVISO_DIAS debe ser menor que RETENCION_CV_MESES en días (usando 28 días/mes como piso).');
}

const env = {
  nodeEnv: process.env.NODE_ENV,
  esProduccion,
  esDesarrollo: process.env.NODE_ENV === 'development',
  puerto,
  apiUrl: process.env.API_URL || `http://localhost:${puerto}`,
  webUrl: process.env.WEB_URL,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    nombre: process.env.DB_NAME,
    usuario: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  // Nunca por debajo de 12 (docs/03-seguridad.md), aunque la variable traiga un valor menor.
  bcryptRounds: Math.max(12, Number(process.env.BCRYPT_ROUNDS) || 12),
  // Sin SMTP_HOST, correo.service.js usa Ethereal (desarrollo) o solo registra el mensaje (test).
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    usuario: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
  },
  mailFrom: process.env.MAIL_FROM || 'Proxi <no-responder@proxi.cl>',
  rutCifradoKey: process.env.RUT_CIFRADO_KEY,
  // Regla de negocio, no un secreto: default igual al de .env.example si no está seteada.
  plazoDeclararCierreDias: Number(process.env.PLAZO_DECLARAR_CIERRE_DIAS) || 7,
  slaRespuestaDias: Number(process.env.SLA_RESPUESTA_DIAS) || 15,
  retencionCvMeses,
  retencionAvisoDias,
  // Relativo a la raíz del monorepo, igual que la ruta del .env de arriba: fuera de apps/web y
  // fuera de cualquier carpeta que la API sirva como estática (hoy no sirve ninguna).
  uploadDir: path.resolve(__dirname, '../../../../', process.env.UPLOAD_DIR || 'almacenamiento/cv'),
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES) || 5 * 1024 * 1024,
};

module.exports = env;
