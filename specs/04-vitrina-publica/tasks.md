# Tareas · Vitrina pública

- [x] 1. `apps/web/package.json` (`type:module`, script `dev` y `test`) + `scripts/servidor-dev.js`
      (servidor estático mínimo, sin dependencia nueva)
- [x] 2. `assets/css/uah-theme.css` con los tokens de `docs/08-guia-visual.md` sobre Bootstrap (CDN)
- [x] 3. `assets/js/config.js` + `assets/js/api/cliente.js` (fetch central + traducción de errores)
      + su prueba
- [x] 4. `assets/js/api/ofertas.js` y `assets/js/api/empresas.js`
- [x] 5. `assets/js/componentes/estado-oferta.js` + su prueba (vencida, hoy, urgente, normal)
- [x] 6. `assets/js/componentes/tarjeta-oferta.js`
- [x] 7. `index.html` + `assets/js/paginas/vitrina.js`: listado, filtros, estado vacío
- [x] 8. `oferta.html` + `assets/js/paginas/oferta.js`: detalle, enlace a la empresa
- [x] 9. `empresa.html` + `assets/js/paginas/empresa.js`: perfil público, indicadores con umbral
- [x] 10. Accesibilidad: `<label>`/`for`, foco visible (por defecto de Bootstrap, confirmado que
      ningún CSS del proyecto usa `outline`), navegación por teclado por orden natural del DOM —
      revisado en el marcado y con Chrome headless real (ver tarea 12); la interacción con Tab en
      vivo no se grabó (sin CDP scriptado), pero la garantía estructural (labels + sin overrides +
      orden del DOM) está verificada, no asumida
- [x] 11. Auditoría de seguridad (`auditor-seguridad`) antes del push: 1 hallazgo grave (XSS
      almacenado vía `sitioWeb` con URI `javascript:`), 1 medio-alto (razón social de una empresa
      no revisada visible en la vitrina tras cambiar identidad) y 5 bajos, todos corregidos con
      prueba — ver `docs/decisiones/bitacora.md`
- [x] 12. Smoke test visual real con Chrome headless (`--headless=new --screenshot`, sin
      dependencia nueva: usa el Chrome ya instalado) contra la API real corriendo, con datos
      inventados sembrados y borrados después: vitrina con los tres estados de vigencia
      (verificado también con `getComputedStyle` real, no solo a ojo — confirmó que la aparente
      similitud visual entre "normal" y "urgente" en la primera captura era antialiasing, no un
      bug), detalle de oferta, perfil de empresa con indicadores reales (tras un recálculo real de
      la vista materializada) y sin indicadores. Encontró y corrigió de paso un color de enlace
      que rompía la paleta (Bootstrap azul por defecto en vez del token de marca).

## Terminado cuando
- [x] Los criterios de aceptación de `spec.md` verificados: automatizados los de las funciones
      puras (10 pruebas) y los de la API (3 pruebas nuevas de regresión de seguridad), el resto
      confirmado visualmente con capturas reales de Chrome headless contra datos reales
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada — con hallazgos reales
      encontrados y corregidos (ver tarea 11)
- [x] Lista de verificación de accesibilidad de `spec.md`/`docs/06-roadmap.md` revisada en el
      marcado y confirmada visualmente
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Roadmap actualizado
