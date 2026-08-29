// Precarga para `npm test`: fuerza NODE_ENV=test sin depender de lo que traiga el .env local.
// dotenv (en config/env.js) nunca sobreescribe una variable que ya está seteada, así que esto gana.
process.env.NODE_ENV = 'test';
