# Generador de Toma de Ramos

Proyecto estático para generar horarios sin topes usando datos de `ING_CIVIL_INDUSTRIAL.xls`.

## Cómo usarlo localmente

Abre `index.html` directamente en el navegador. También puedes correr un servidor simple:

```bash
python3 -m http.server 3000
```

Luego entra a `http://localhost:3000`.

## Cómo desplegarlo en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel, elige **New Project** e importa el repositorio.
3. Framework: **Other** o **Static**.
4. Build command: dejar vacío.
5. Output directory: dejar vacío o `.`.

## Cómo actualizar los datos

La app usa dos archivos:

- `data/ramos.json`: datos legibles.
- `data/data.js`: los mismos datos cargados como variable global para que funcione incluso abriendo el HTML localmente.

Para convertir un nuevo Excel `.xls`:

```bash
pip install xlrd
python scripts/convert_xls_to_json.py ING_CIVIL_INDUSTRIAL.xls
```

Eso reemplaza `data/ramos.json` y `data/data.js`.

## Qué hace el generador

- Agrega ramos por código o nombre.
- Permite activar/desactivar secciones.
- Elimina combinaciones con topes de horario.
- Ordena por menos ventanas, salir temprano, entrar tarde u horario compacto.
- Puede priorizar dejar libre un día.

## Ojo

El resultado depende totalmente de que el archivo Excel venga con columnas similares a:

- Asignatura
- Nombre Asig.
- Créditos Asignatura
- Sección
- Descrip. Evento
- Horario
- Profesor
- Paquete
- Vac. Paquete
