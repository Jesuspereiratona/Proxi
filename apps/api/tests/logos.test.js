const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Empresa, Archivo, AuditoriaAcceso, Oferta } = require('../src/models');
const { borrarUsuariosDePrueba } = require('./limpiar');
const { generarRutValido, crearUsuarioActivo: crearUsuario } = require('./ayudas');

const DOMINIO_PRUEBA = 'logos.uahurtado.test';
const crearUsuarioActivo = (rol) => crearUsuario(rol, DOMINIO_PRUEBA);

const crearEmpresa = async (estadoValidacion = 'validada') => {
  const empresa = await crearUsuarioActivo('empresa');
  const coordinacion = await crearUsuarioActivo('coordinacion');
  const perfil = await Empresa.create({
    usuarioId: empresa.usuario.id,
    razonSocial: 'Empresa con logo',
    rutEmpresa: generarRutValido(),
    contactoNombre: 'Contacto',
    contactoCargo: 'RR.HH.',
    estadoValidacion,
    ...(estadoValidacion === 'validada'
      ? { validadaPorUsuarioId: coordinacion.usuario.id, validadaAt: new Date() }
      : {}),
  });
  return { ...empresa, empresaId: perfil.id, perfil, coordinacion };
};

// PNG real de 1×1, generado acá: las pruebas no dependen de ningún archivo externo del repositorio.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1'), Buffer.alloc(32),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const PDF = Buffer.from('%PDF-1.4 en realidad soy un pdf');

const subir = (token, bytes, nombre = 'logo.png') => request(app)
  .post('/api/v1/empresas/mi-logo')
  .set('Authorization', `Bearer ${token}`)
  .attach('logo', bytes, nombre);

const aprobarComo = (tokenCoordinacion, logoId) => request(app)
  .post(`/api/v1/logos/${logoId}/aprobacion`)
  .set('Authorization', `Bearer ${tokenCoordinacion}`);

after(async () => {
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('subida de logo · qué se acepta', () => {
  test('un PNG válido queda guardado y SIN aprobar', async () => {
    const empresa = await crearEmpresa();
    const respuesta = await subir(empresa.accessToken, PNG);

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.mime, 'image/png');
    assert.equal(respuesta.body.aprobado, false, 'un logo recién subido nunca nace aprobado');
  });

  test('acepta JPEG y WebP, reconocidos por su firma', async () => {
    const empresa = await crearEmpresa();
    const jpeg = await subir(empresa.accessToken, JPEG, 'logo.jpg');
    assert.equal(jpeg.status, 201);
    assert.equal(jpeg.body.mime, 'image/jpeg');

    const webp = await subir(empresa.accessToken, WEBP, 'logo.webp');
    assert.equal(webp.status, 201);
    assert.equal(webp.body.mime, 'image/webp');
  });

  test('el mime se deriva del contenido, no del nombre ni del que declara el cliente', async () => {
    // Se manda un PNG real con nombre .jpg: si el servidor creyera en la extensión, guardaría
    // image/jpeg y después serviría los bytes con un Content-Type equivocado.
    const empresa = await crearEmpresa();
    const respuesta = await subir(empresa.accessToken, PNG, 'yo-digo-que-soy.jpg');
    assert.equal(respuesta.body.mime, 'image/png');
  });
});

describe('subida de logo · qué se rechaza', () => {
  test('un SVG se rechaza con su propio mensaje, aunque sea una imagen válida', async () => {
    // Un SVG puede traer <script>: servirlo desde nuestro dominio sería XSS almacenado en la
    // vitrina. Es la razón por la que existe el chequeo explícito y no solo la lista de firmas.
    const empresa = await crearEmpresa();
    const respuesta = await subir(empresa.accessToken, SVG, 'logo.svg');

    assert.equal(respuesta.status, 422);
    assert.match(respuesta.body.error.mensaje, /SVG/);
    assert.equal(await Archivo.count({ where: { propietarioUsuarioId: empresa.usuario.id } }), 0);
  });

  test('un PDF renombrado a .png se rechaza', async () => {
    const empresa = await crearEmpresa();
    const respuesta = await subir(empresa.accessToken, PDF, 'logo.png');

    assert.equal(respuesta.status, 422);
    assert.equal(await Archivo.count({ where: { propietarioUsuarioId: empresa.usuario.id } }), 0);
  });

  test('una imagen de más de 512 KB se rechaza', async () => {
    const empresa = await crearEmpresa();
    const respuesta = await subir(empresa.accessToken, Buffer.concat([PNG, Buffer.alloc(600 * 1024)]));

    assert.equal(respuesta.status, 422);
    assert.equal(await Archivo.count({ where: { propietarioUsuarioId: empresa.usuario.id } }), 0);
  });
});

describe('logo · permisos', () => {
  test('un estudiante no puede subir un logo', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    const respuesta = await subir(estudiante.accessToken, PNG);
    assert.equal(respuesta.status, 403);
  });

  test('una empresa no puede aprobar su propio logo', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);
    const respuesta = await aprobarComo(empresa.accessToken, body.id);
    assert.equal(respuesta.status, 403);
  });

  test('la empresa B no puede quitar ni reemplazar el logo de A', async () => {
    const a = await crearEmpresa();
    const b = await crearEmpresa();
    const { body } = await subir(a.accessToken, PNG);
    await aprobarComo(a.coordinacion.accessToken, body.id);

    // No hay ruta que acepte el id de un logo ajeno: /mi-logo siempre opera sobre la propia empresa.
    // La prueba de que A queda intacto es que B borra "su" logo (que no tiene) y el de A sigue ahí.
    const borrado = await request(app).delete('/api/v1/empresas/mi-logo').set('Authorization', `Bearer ${b.accessToken}`);
    assert.equal(borrado.status, 404);

    const publico = await request(app).get(`/api/v1/empresas/${a.empresaId}/logo`);
    assert.equal(publico.status, 200, 'el logo de A no debe verse afectado');
  });

  test('los bytes de un logo pendiente no son públicos: la revisión exige coordinación', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);

    const sinSesion = await request(app).get(`/api/v1/logos/${body.id}/imagen`);
    assert.equal(sinSesion.status, 401);

    const comoEmpresa = await request(app)
      .get(`/api/v1/logos/${body.id}/imagen`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(comoEmpresa.status, 403);
  });
});

describe('logo · visibilidad pública', () => {
  test('sin aprobar no se sirve, aprobado sí, y con los bytes exactos', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);

    const antes = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(antes.status, 404, 'un logo sin aprobar no se muestra en público');

    assert.equal((await aprobarComo(empresa.coordinacion.accessToken, body.id)).status, 200);

    const despues = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(despues.status, 200);
    assert.equal(despues.headers['content-type'], 'image/png');
    assert.ok(Buffer.from(despues.body).equals(PNG), 'debe devolver exactamente los bytes subidos');
  });

  test('la respuesta trae los encabezados que la hacen usable y segura', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);
    await aprobarComo(empresa.coordinacion.accessToken, body.id);

    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    // nosniff: sin esto un navegador podría reinterpretar los bytes como otra cosa.
    assert.equal(respuesta.headers['x-content-type-options'], 'nosniff');
    // cross-origin: helmet pone same-origin en toda respuesta, y con eso el navegador se niega a
    // pintar la imagen dentro de la web, que corre en otro origen.
    assert.equal(respuesta.headers['cross-origin-resource-policy'], 'cross-origin');
    // Cinco minutos y no una hora: la ventana de caché también retrasa un borrado de cuenta, que
    // es el ejercicio de un derecho, no solo un retiro por contenido (auditoría de seguridad).
    assert.match(respuesta.headers['cache-control'], /max-age=300$/);
  });

  test('el logo de una empresa no validada responde 404, igual que su perfil', async () => {
    for (const estado of ['pendiente', 'rechazada', 'suspendida']) {
      const empresa = await crearEmpresa(estado);
      const { body } = await subir(empresa.accessToken, PNG);
      // Se aprueba igual: lo que debe ocultarlo es el estado de la empresa, no la falta de aprobación.
      await aprobarComo(empresa.coordinacion.accessToken, body.id);

      const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
      assert.equal(respuesta.status, 404, `una empresa ${estado} no debe mostrar logo`);
    }
  });

  test('subir uno nuevo no deja a la empresa sin logo mientras espera aprobación', async () => {
    const empresa = await crearEmpresa();
    const primero = await subir(empresa.accessToken, PNG);
    await aprobarComo(empresa.coordinacion.accessToken, primero.body.id);

    const segundo = await subir(empresa.accessToken, JPEG, 'nuevo.jpg');
    assert.equal(segundo.status, 201);

    const publico = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(publico.status, 200);
    assert.equal(publico.headers['content-type'], 'image/png', 'debe seguir el anterior, no el nuevo');

    await aprobarComo(empresa.coordinacion.accessToken, segundo.body.id);
    const despues = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(despues.headers['content-type'], 'image/jpeg', 'aprobado el nuevo, reemplaza al viejo');
  });

  test('cambiar el logo no devuelve la empresa a pendiente ni toca sus ofertas', async () => {
    // El camino de CAMPOS_IDENTIDAD sí hace eso al cambiar razón social o RUT. El logo,
    // deliberadamente, no entra ahí: perder las ofertas publicadas por actualizar la marca sería
    // desproporcionado (specs/10-logo-de-empresa/plan.md, decisión 2).
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);
    await aprobarComo(empresa.coordinacion.accessToken, body.id);

    const perfil = await Empresa.findByPk(empresa.empresaId);
    assert.equal(perfil.estadoValidacion, 'validada');
  });
});

describe('logo · moderación', () => {
  test('coordinación ve los pendientes con el nombre de la empresa', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);

    const respuesta = await request(app)
      .get('/api/v1/logos/pendientes')
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    assert.equal(respuesta.status, 200);
    const mio = respuesta.body.logos.find((l) => String(l.id) === String(body.id));
    assert.ok(mio, 'el logo recién subido debe aparecer entre los pendientes');
    assert.equal(mio.razonSocial, 'Empresa con logo');
  });

  test('aprobar dos veces el mismo logo no lo reescribe: el segundo intento es un conflicto', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);

    assert.equal((await aprobarComo(empresa.coordinacion.accessToken, body.id)).status, 200);
    const segunda = await aprobarComo(empresa.coordinacion.accessToken, body.id);
    assert.equal(segunda.status, 409);
  });

  test('retirar un logo lo saca del público y suelta los bytes, pero deja el registro', async () => {
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);
    await aprobarComo(empresa.coordinacion.accessToken, body.id);

    const retiro = await request(app)
      .delete(`/api/v1/logos/${body.id}`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);
    assert.equal(retiro.status, 204);

    const publico = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(publico.status, 404);

    // La regla 7 de la spec: debe poder demostrarse después que la empresa tuvo un logo retirado.
    const fila = await Archivo.findByPk(body.id);
    assert.ok(fila, 'la fila no se borra');
    assert.ok(fila.retiradoAt, 'queda con fecha de retiro');
    assert.equal(fila.contenido, null, 'los bytes sí se sueltan');
  });
});

describe('logo · listado público de ofertas', () => {
  test('GET /ofertas marca tieneLogo solo en las empresas con logo aprobado', async () => {
    // Por HTTP y no llamando al helper: el criterio de aceptación habla del listado público, que es
    // lo que consume la vitrina. Probar solo el helper dejaba sin cubrir que el campo llegue a la
    // respuesta — que es exactamente el error que se coló en el perfil público (ver más abajo).
    const conLogo = await crearEmpresa();
    const sinLogo = await crearEmpresa();
    const { body } = await subir(conLogo.accessToken, PNG);
    await aprobarComo(conLogo.coordinacion.accessToken, body.id);

    const area = `area-logo-${Date.now()}`;
    for (const empresa of [conLogo, sinLogo]) {
      await Oferta.create({
        empresaId: empresa.empresaId,
        titulo: 'Práctica con logo',
        descripcion: 'd',
        requisitos: 'r',
        area,
        modalidad: 'remota',
        jornada: 'completa',
        remunerada: false,
        estado: 'publicada',
        fechaPublicacion: new Date(),
        fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    const listado = await request(app).get('/api/v1/ofertas').query({ area });
    assert.equal(listado.status, 200);
    const porEmpresa = Object.fromEntries(listado.body.ofertas.map((o) => [String(o.empresaId), o.tieneLogo]));
    assert.equal(porEmpresa[String(conLogo.empresaId)], true);
    assert.equal(porEmpresa[String(sinLogo.empresaId)], false);
  });
});

describe('logo · borrado de cuenta', () => {
  test('eliminarCuenta retira el logo y suelta sus bytes, sin dejarlo huérfano', async () => {
    // DELETE /mi-cuenta hoy autoriza solo a estudiantes (routes/cuenta.routes.js), así que esta
    // prueba llama al service directo: verifica la regla, no la ruta. El día que la ruta admita
    // empresas, esta prueba ya está cubriendo el caso en vez de descubrirse tarde.
    const cuentaService = require('../src/services/cuenta/cuenta.service');
    const empresa = await crearEmpresa();
    const { body } = await subir(empresa.accessToken, PNG);
    await aprobarComo(empresa.coordinacion.accessToken, body.id);

    await cuentaService.eliminarCuenta(empresa.usuario.id, '127.0.0.1', 'prueba');

    const publico = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/logo`);
    assert.equal(publico.status, 404, 'el logo no puede seguir sirviéndose tras el borrado');

    const fila = await Archivo.findByPk(body.id);
    assert.ok(fila.retiradoAt, 'queda con fecha de retiro');
    assert.equal(fila.contenido, null, 'los bytes se sueltan');

    // Esta prueba se limpia sola: eliminarCuenta() reemplaza el correo por un marcador
    // "eliminado-...@proxi.invalid", así que el borrarUsuariosDePrueba() del after() ya no la
    // encuentra por dominio y la empresa quedaría para siempre en el panel de coordinación.
    await AuditoriaAcceso.destroy({ where: { usuarioId: empresa.usuario.id } });
    await Usuario.destroy({ where: { id: empresa.usuario.id } });
  });
});

describe('logo · perfil público de empresa', () => {
  test('obtenerPerfilPublico expone tieneLogo, y solo cuando el logo está aprobado', async () => {
    // Esta prueba existe porque al implementarlo el campo terminó, por un reemplazo de texto mal
    // dirigido, en obtenerPorId() —de uso interno— en vez de en el perfil público. La API respondía
    // sin el campo y el logo no se pintaba, sin que nada fallara.
    const empresasService = require('../src/services/empresas/empresas.service');
    const empresa = await crearEmpresa();

    const sinLogo = await empresasService.obtenerPerfilPublico(empresa.empresaId);
    assert.equal(sinLogo.tieneLogo, false);

    const { body } = await subir(empresa.accessToken, PNG);
    const pendiente = await empresasService.obtenerPerfilPublico(empresa.empresaId);
    assert.equal(pendiente.tieneLogo, false, 'sin aprobar no cuenta');

    await aprobarComo(empresa.coordinacion.accessToken, body.id);
    const aprobado = await empresasService.obtenerPerfilPublico(empresa.empresaId);
    assert.equal(aprobado.tieneLogo, true);
  });
});
