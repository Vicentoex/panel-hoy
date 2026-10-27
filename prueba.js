// Página de prueba: ¿llega la carga tras «#p1=» intacta? ¿se guarda en el móvil?
// No hace ninguna petición de red (CSP connect-src 'none').
"use strict";

const CLAVE = "panel_hoy_ultima";
const filas = [];
const fila = (nombre, valor, ok) => filas.push([nombre, valor, ok]);

function b64urlABytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function descomprimir(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(flujo).text();
}

function leerHash() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return { hash, p1: params.get("p1"), tg: params.has("tgWebAppData") || params.has("tgWebAppVersion") };
}

function guardarLocal(texto) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ momento: new Date().toISOString(), texto })); return true; }
  catch (e) { return false; }
}

function leerLocal() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; }
}

function dispositivoTelegram() {
  const wa = window.Telegram && window.Telegram.WebApp;
  return wa && wa.initData !== undefined && wa.platform !== "unknown" ? wa : null;
}

function probarDeviceStorage(wa, texto) {
  return new Promise((resolver) => {
    const ds = wa && wa.DeviceStorage;
    if (!ds || !wa.isVersionAtLeast || !wa.isVersionAtLeast("9.0")) return resolver("no disponible");
    try {
      ds.setItem(CLAVE, texto.slice(0, 4000), (err) => {
        if (err) return resolver("error al guardar: " + err);
        ds.getItem(CLAVE, (err2, valor) => resolver(err2 ? "error al leer: " + err2 : `ok (${(valor || "").length} car.)`));
      });
    } catch (e) { resolver("excepción: " + e.message); }
  });
}

async function main() {
  const { hash, p1, tg } = leerHash();
  const wa = dispositivoTelegram();
  if (wa) { wa.ready(); wa.expand(); }
  fila("Abierta desde", wa ? `Telegram Mini App (${wa.platform}, Bot API ${wa.version})` : "navegador", true);
  fila("Longitud del fragmento", `${hash.length} caracteres`, hash.length > 0);
  fila("Parámetros de Telegram en el fragmento", tg ? "sí" : "no", true);
  fila("Carga p1 presente", p1 ? `sí (${p1.length} car.)` : "no", !!p1);

  let texto = null;
  if (p1) {
    try {
      texto = await descomprimir(b64urlABytes(p1));
      const datos = JSON.parse(texto);
      const esperado = datos.control && datos.control.caracteres;
      fila("Descompresión y JSON", "ok", true);
      fila("Integridad", esperado === p1.length ? "intacta" : `esperaba ${esperado}, llegaron ${p1.length}`, esperado === p1.length);
      document.getElementById("carga").textContent = JSON.stringify(datos, null, 2);
      fila("Guardado local (localStorage)", guardarLocal(texto) ? "ok" : "falló", true);
    } catch (e) {
      fila("Descompresión y JSON", "falló: " + e.message, false);
    }
  }
  const previa = leerLocal();
  fila("Última carga guardada en el móvil", previa ? new Date(previa.momento).toLocaleString("es-ES") : "ninguna", !!previa);
  if (!texto && previa) document.getElementById("carga").textContent = previa.texto;
  if (wa) fila("DeviceStorage de Telegram", await probarDeviceStorage(wa, texto || (previa && previa.texto) || "vacío"), true);

  const dl = document.createElement("dl");
  for (const [n, v, ok] of filas) {
    const dt = document.createElement("dt"); dt.textContent = n;
    const dd = document.createElement("dd"); dd.textContent = v; dd.className = ok ? "ok" : "mal";
    dl.append(dt, dd);
  }
  document.getElementById("resultado").replaceChildren(dl);
}

main();
