# Refuerzos educativos

Diario de sesiones de **refuerzo educativo** para centros de Primaria. Es una
web app de Google Apps Script, pensada para el móvil y para el ordenador,
que usa una hoja de cálculo de Google como base de datos.

El horario de refuerzos se toma de la **hoja madre**, que es la base de datos del
[Gestor de Horarios y Sustituciones](https://github.com/maestroseb/organizacion-escolar).

## Qué hace

- **Registrar.** Al entrar, la app identifica al docente por su email. Según el
  día y la hora, propone el tramo de refuerzo que toca y carga el alumnado de
  ese grupo en píldoras. El docente elige al alumnado, la materia (Lengua,
  Matemáticas u Otros), escribe lo trabajado y valora el aprovechamiento con
  estrellas. Se guarda **un registro por sesión**, compartido por todo el
  alumnado seleccionado.
  - El día y el tramo se pueden cambiar para registrar sesiones atrasadas.
  - Con «Añadir» se busca alumnado de cualquier grupo o se da de alta a
    alguien nuevo.
  - Por defecto aparece marcado el alumnado de la última sesión de esa franja.
  - Se muestran las sesiones anteriores del alumnado elegido y unas
    sugerencias de texto según la materia.
  - Lo que no se ha guardado queda como borrador en el navegador.
  - **Sesiones no realizadas.** Si el refuerzo no pudo hacerse, se registra
    como «No se pudo realizar» indicando el motivo: sustitución, ausencia del
    alumnado, actividad del centro u otro. La app consulta las
    **sustituciones de la hoja madre**: si en ese tramo el docente estaba
    sustituyendo, lo avisa y lo deja marcado; basta con guardar.
- **Diario.** Recoge todas las sesiones del centro, que puede ver todo el
  profesorado. Se puede filtrar por periodo, grupo, alumno o alumna, materia y
  docente, buscar texto y exportar a CSV. Cada docente edita y borra sus propios
  registros; la administración, todos.
- **Datos.** Indicadores de sesiones, alumnado atendido, aprovechamiento medio
  y cumplimiento (sesiones registradas frente a las previstas por horario).
  Incluye gráficos de sesiones por semana y materia, evolución del
  aprovechamiento, un mapa de calor por día y tramo, y tablas de alumnado y
  profesorado. Cada alumno o alumna tiene una **ficha** que se puede imprimir.
- **Ajustes** (solo administración):
  - Conexión con la hoja madre, con sincronización manual o cada noche.
  - Profesorado, con sus emails, los de sus sustitutos y el rol de administración.
  - Editor visual de horarios de refuerzo, con semanas A y B.
  - Alumnado por grupo, también con alta en bloque pegando una lista.
  - Materias, tramos y grupos.

## Arquitectura

| Archivo | Papel |
|---|---|
| `00_Config.gs` | Nombres de pestañas y cabeceras de la BD |
| `01_Datos.gs` | Creación automática de la BD y lectura/escritura por nombre de campo |
| `02_Usuario.gs` | Identificación por email y permisos |
| `03_Api.gs` | Funciones que llama el cliente (`google.script.run`) |
| `04_Sincro.gs` | Lectura de la hoja madre y activador nocturno |
| `09_Web.gs` | `doGet` e `include` |
| `index.html` + `estilos.html` + `js_*.html` | La SPA: sistema de diseño claro/oscuro y una vista por archivo |

La BD se crea sola la primera vez en el Drive de quien despliega la app y tiene
estas pestañas: `Registros`, `Alumnado`, `Docentes`, `Horarios`, `Tramos`,
`Grupos`, `Semanas` y `Config`.

### Qué se toma de la hoja madre

- `_Tramos`, `_Grupos`, `_SemanasAlternas` y `_Docentes`, incluidos `email` y
  `sustituto_email`. Un sustituto o sustituta entra con su email y hereda el
  horario del docente al que sustituye.
- Franjas de refuerzo: son las filas de `_Ocupaciones` con `tipo = localizacion`
  cuyo rol, en `_RolesEspeciales`, se llama «Refuerzo». El grupo que se refuerza
  es `grupo_destino_id`.
- `_Sustituciones`: se leen en directo, con una caché de 5 minutos, para
  avisar de los refuerzos perdidos por sustitución.
- Al sincronizar no se tocan los docentes creados a mano ni los horarios
  editados en Ajustes. Tampoco se pierden los datos que la hoja madre no trae,
  como el sustituto o la marca de administración.

### Seguridad

- Las funciones auxiliares del servidor terminan en `_`. Así son privadas en
  Apps Script y no se pueden llamar desde el navegador.
- Solo usa la app quien figura en `Docentes`, por su email o el de su sustituto.
- Cada docente edita sus propios registros. La administración puede editarlo todo.

## Despliegue

1. Crea un proyecto de Apps Script independiente y sube los archivos con
   [`clasp`](https://github.com/google/clasp) (`clasp create --type standalone`
   y después `clasp push`) o copiándolos a mano.
2. Ve a **Implementar → Nueva implementación → Aplicación web**, con
   *Ejecutar como: yo* y *Quién tiene acceso: cualquier usuario de
   g.educaand.es*. Así cada docente entra con su cuenta y se le identifica
   por su email.
3. Abre la URL. La BD se crea sola y quien despliega es administrador.
4. En **Ajustes → General**, pega el enlace de la hoja madre y pulsa
   **Sincronizar**. Quien despliega debe tener acceso a esa hoja.
5. Da de alta al alumnado de refuerzo en **Ajustes → Alumnado**.

## Desarrollo local

`tools/mock.js` simula `google.script.run` con datos de ejemplo.

```bash
npm i -g playwright         # si no está instalado
node tools/preview.js       # construye tools/out/index.html y hace capturas (móvil, PC, oscuro)
node tools/flujo.js         # prueba un flujo completo: registrar, añadir alumno, diario, ficha, ajustes
```
