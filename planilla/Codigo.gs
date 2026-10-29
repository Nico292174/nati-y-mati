// Recibe las confirmaciones de la invitación y las anota en la hoja "Confirmaciones" de esta planilla.
// Se publica como "Aplicación web" (ver LEEME.md) y su dirección va en BODA.planilla, en index.html.
//
// La invitación manda un JSON como este:
//   { boda, id, asiste: 'si' | 'no', nombre, bebidas: [], comida: [], comidaOtra, cancion, mensaje }
// "id" es un código que la invitación guarda en el celular del invitado: si la misma persona vuelve a confirmar,
// llega el mismo código y acá se reemplaza su fila en vez de duplicarla.

const HOJA = 'Confirmaciones';
const BODA = 'nati-y-mati';
const COLUMNAS = ['Fecha', 'Código', 'Asiste', 'Nombre', 'Bebidas', 'Comida', 'Comida (otra)', 'Canción', 'Mensaje', 'Actualizado'];

function doPost(e) {
  // Un pedido a la vez: si varios invitados confirman en el mismo segundo, se anotan de a uno
  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(20000);
  try {
    const datos = JSON.parse(e.postData.contents);
    if (datos.boda !== BODA) return respuesta({ ok: false, error: 'boda desconocida' });
    const hoja = obtenerHoja();
    const ahora = new Date();
    const fila = [
      ahora,
      String(datos.id || ''),
      datos.asiste === 'no' ? 'No va' : 'Sí',
      String(datos.nombre || '').trim(),
      (datos.bebidas || []).join(', '),
      (datos.comida || []).join(', '),
      String(datos.comidaOtra || '').trim(),
      String(datos.cancion || '').trim(),
      String(datos.mensaje || '').trim(),
      ahora
    ];
    const existente = buscarFila(hoja, fila[1]);
    if (existente) {
      // Conserva la fecha de la primera confirmación y actualiza el resto
      fila[0] = hoja.getRange(existente, 1).getValue() || ahora;
      hoja.getRange(existente, 1, 1, COLUMNAS.length).setValues([fila]);
    } else {
      hoja.appendRow(fila);
    }
    return respuesta({ ok: true, fila: existente || hoja.getLastRow() });
  } catch (err) {
    return respuesta({ ok: false, error: String(err) });
  } finally {
    cerrojo.releaseLock();
  }
}

// Abrir la dirección de la aplicación web en el navegador muestra esto: sirve para ver que está viva
function doGet() {
  const hoja = obtenerHoja();
  return respuesta({ ok: true, hoja: HOJA, confirmaciones: Math.max(0, hoja.getLastRow() - 1) });
}

function obtenerHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);
  if (!hoja) hoja = libro.insertSheet(HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
  }
  return hoja;
}

function buscarFila(hoja, id) {
  if (!id) return 0;
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const codigos = hoja.getRange(2, 2, ultima - 1, 1).getValues();
  for (let i = 0; i < codigos.length; i++) {
    if (String(codigos[i][0]) === id) return i + 2;
  }
  return 0;
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Para probar desde el editor (Ejecutar ▶ con esta función elegida): anota una confirmación de ejemplo.
// La primera vez Google pide autorizar el acceso a la planilla; es normal.
function probar() {
  const ejemplo = {
    boda: BODA, id: 'prueba-' + Date.now().toString(36), asiste: 'si', nombre: 'Invitado de prueba',
    bebidas: ['Gin tonic', 'Champagne'], comida: ['Vegetariano'], comidaOtra: '', cancion: 'Marry You', mensaje: '¡Felicitaciones!'
  };
  const salida = doPost({ postData: { contents: JSON.stringify(ejemplo) } });
  Logger.log(salida.getContent());
}
