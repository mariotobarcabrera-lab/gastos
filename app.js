/* ===== Estado ===== */
function leer(clave, defecto){
    try{
        const v = JSON.parse(localStorage.getItem(K + clave));
        return v === null || v === undefined ? defecto : v;
    }catch(e){ return defecto; }
}

let K = "";   // prefijo por usuario
let categorias = [];
let datos = {};
let deudas = [];
let categoriaActual = 0;
let listaCaptura = [];

function guardar(){
    try{
        localStorage.setItem(K + "categorias", JSON.stringify(categorias));
        localStorage.setItem(K + "datos", JSON.stringify(datos));
        localStorage.setItem(K + "deudas", JSON.stringify(deudas));
        localStorage.setItem(K + "actualizado", String(Date.now()));
    }catch(e){ console.error("No se pudo guardar", e); }
    if(window.nubeSubir) window.nubeSubir();
}

/* Puente con la nube (lo usa el módulo de Firebase del final) */
window.obtenerEstado = function(){
    return {categorias, datos, deudas, actualizado: Number(localStorage.getItem(K + "actualizado")) || 0};
};
window.aplicarDatosNube = function(d, actualizado){
    categorias = d.categorias || [];
    datos = d.datos || {};
    deudas = d.deudas || [];
    try{
        localStorage.setItem(K + "categorias", JSON.stringify(categorias));
        localStorage.setItem(K + "datos", JSON.stringify(datos));
        localStorage.setItem(K + "deudas", JSON.stringify(deudas));
        localStorage.setItem(K + "actualizado", String(actualizado));
    }catch(e){}
    cargarCategorias();
    cargarDeudas();
    cargarMes();
};

/* ===== Utilidades ===== */
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : n; };
const dinero = n => n.toLocaleString(window.LOCALE || "es", {style:"currency", currency:"USD"});
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function mesActual(){ return $("mes").value; }
function datosMes(){
    const m = mesActual();
    if(!datos[m]) datos[m] = {ingreso:0, presupuesto:0, gastos:{}};
    if(!datos[m].gastos) datos[m].gastos = {};
    return datos[m];
}
function montoGasto(cat){
    return cat.tipo === "fija" ? num(cat.monto) : num(datosMes().gastos[cat.id]);
}
function totalGastos(){
    return categorias.reduce((s,c) => s + montoGasto(c), 0);
}

/* ===== Información del mes ===== */
function cargarMes(){
    const d = datosMes();
    $("ingreso").value = d.ingreso || "";
    $("presupuesto").value = d.presupuesto || "";
    cargarTabla();
    actualizarDashboard();
}
function guardarInfoMes(){
    const d = datosMes();
    d.ingreso = num($("ingreso").value);
    d.presupuesto = num($("presupuesto").value);
    guardar();
    cargarTabla();
    actualizarDashboard();
}

/* ===== Categorías ===== */
function agregarCategoria(){
    const nombre = $("nombreCategoria").value.trim();
    const tipo = $("tipoCategoria").value;
    const monto = num($("montoCategoria").value);
    if(!nombre){ alert(t("Escribe el nombre de la categoría.")); return; }
    if(tipo === "fija" && monto <= 0){ alert(t("Las categorías fijas necesitan un monto.")); return; }
    categorias.push({id:nuevoId(), nombre, tipo, monto: tipo === "fija" ? monto : 0});
    $("nombreCategoria").value = "";
    $("montoCategoria").value = "";
    guardar();
    cargarCategorias();
    cargarTabla();
    actualizarDashboard();
}

function editarCategoria(id, campo, valor){
    const c = categorias.find(x => x.id === id);
    if(!c) return;
    if(campo === "nombre"){
        valor = valor.trim();
        if(!valor){ cargarCategorias(); return; }
        c.nombre = valor;
    }else if(campo === "tipo"){
        c.tipo = valor;
        if(valor === "variable") c.monto = 0;
    }else if(campo === "monto"){
        c.monto = num(valor);
    }
    guardar();
    cargarCategorias();
    cargarTabla();
    actualizarDashboard();
}

function duplicarCategoria(id){
    const c = categorias.find(x => x.id === id);
    if(!c) return;
    const copia = {...c, id:nuevoId(), nombre:c.nombre + " " + t("(copia)")};
    categorias.splice(categorias.indexOf(c)+1, 0, copia);
    guardar();
    cargarCategorias();
    cargarTabla();
    actualizarDashboard();
}

function eliminarCategoria(id){
    const c = categorias.find(x => x.id === id);
    if(!c) return;
    if(!confirm(t('¿Eliminar la categoría "{n}"?', {n: c.nombre}))) return;
    categorias = categorias.filter(x => x.id !== id);
    Object.values(datos).forEach(m => { if(m.gastos) delete m.gastos[id]; });
    guardar();
    cargarCategorias();
    cargarTabla();
    actualizarDashboard();
}

function cargarCategorias(){
    const cont = $("listaCategorias");
    if(!categorias.length){
        cont.innerHTML = '<p class="vacio">' + t("Aún no hay categorías.") + '</p>';
        return;
    }
    cont.innerHTML = categorias.map(c => `
        <div class="item">
            <div class="row">
                <input type="text" value="${esc(c.nombre)}" aria-label="${t('Nombre')}"
                    onchange="editarCategoria('${c.id}','nombre',this.value)">
                <select aria-label="${t('Tipo')}" onchange="editarCategoria('${c.id}','tipo',this.value)">
                    <option value="variable" ${c.tipo==="variable"?"selected":""}>${t("Variable")}</option>
                    <option value="fija" ${c.tipo==="fija"?"selected":""}>${t("Fija")}</option>
                </select>
                ${c.tipo === "fija"
                    ? `<input type="number" min="0" step="0.01" value="${num(c.monto)}" aria-label="${t('Monto fijo')}"
                        onchange="editarCategoria('${c.id}','monto',this.value)">`
                    : `<span class="vacio">${t("Monto variable")}</span>`}
            </div>
            <div class="acciones">
                <button onclick="duplicarCategoria('${c.id}')">${t("Duplicar")}</button>
                <button class="danger" onclick="eliminarCategoria('${c.id}')">${t("Eliminar")}</button>
            </div>
        </div>`).join("");
}

function abrirCategorias(){ cargarCategorias(); $("modalCategorias").style.display = "block"; }
function cerrarCategorias(){ $("modalCategorias").style.display = "none"; }

/* ===== Deudas (permanentes, no dependen del mes) ===== */
function agregarDeuda(){
    const nombre = $("nombreDeuda").value.trim();
    const inicial = num($("montoInicial").value);
    const saldoTxt = $("saldoDeuda").value;
    const saldo = saldoTxt === "" ? inicial : num(saldoTxt);
    if(!nombre || inicial <= 0){ alert(t("Indica el nombre y el monto original.")); return; }
    deudas.push({id:nuevoId(), nombre, inicial, saldo: Math.min(saldo, inicial)});
    $("nombreDeuda").value = "";
    $("montoInicial").value = "";
    $("saldoDeuda").value = "";
    guardar();
    cargarDeudas();
    actualizarDashboard();
}

function editarDeuda(id){
    const d = deudas.find(x => x.id === id);
    if(!d) return;
    const nombre = prompt(t("Nombre de la deuda:"), d.nombre);
    if(nombre === null) return;
    const inicial = prompt(t("Monto original:"), d.inicial);
    if(inicial === null) return;
    const saldo = prompt(t("Saldo pendiente:"), d.saldo);
    if(saldo === null) return;
    const ini = num(inicial);
    if(!nombre.trim() || ini <= 0){ alert(t("Datos no válidos.")); return; }
    d.nombre = nombre.trim();
    d.inicial = ini;
    d.saldo = Math.min(num(saldo), ini);
    guardar();
    cargarDeudas();
    actualizarDashboard();
}

function eliminarDeuda(id){
    const d = deudas.find(x => x.id === id);
    if(!d) return;
    if(!confirm(t('¿Eliminar la deuda "{n}"?', {n: d.nombre}))) return;
    deudas = deudas.filter(x => x.id !== id);
    guardar();
    cargarDeudas();
    actualizarDashboard();
}

function cargarDeudas(){
    const cont = $("listaDeudas");
    if(!deudas.length){
        cont.innerHTML = '<p class="vacio">' + t("No hay deudas registradas.") + '</p>';
        return;
    }
    cont.innerHTML = deudas.map(d => {
        const pagado = Math.max(0, d.inicial - d.saldo);
        const pct = d.inicial > 0 ? Math.min(100, Math.round(pagado / d.inicial * 100)) : 0;
        return `
        <div class="item">
            <h3>${esc(d.nombre)}</h3>
            <p>${t("Original: {o} · Pagado: {p} · Pendiente: {r}", {o: dinero(d.inicial), p: dinero(pagado), r: dinero(d.saldo)})}</p>
            <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                <div class="progress-bar" style="width:${pct}%"></div>
            </div>
            <p>${t("{p}% pagado", {p: pct})}</p>
            <br>
            <div class="acciones" style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="editarDeuda('${d.id}')">${t("Editar")}</button>
                <button class="danger" onclick="eliminarDeuda('${d.id}')">${t("Eliminar")}</button>
            </div>
        </div>`;
    }).join("");
}

/* ===== Tabla, alertas y dashboard ===== */
function cargarTabla(){
    const tbody = $("tablaGastos");
    if(!categorias.length){
        tbody.innerHTML = '<tr><td colspan="3" class="vacio">' + t("Crea una categoría para empezar.") + '</td></tr>';
    }else{
        tbody.innerHTML = categorias.map(c => `
            <tr>
                <td>${esc(c.nombre)}</td>
                <td>${c.tipo === "fija" ? t("Fija") : t("Variable")}</td>
                <td class="num">${dinero(montoGasto(c))}</td>
            </tr>`).join("") +
            `<tr class="total"><td colspan="2">${t("Total")}</td><td class="num">${dinero(totalGastos())}</td></tr>`;
    }
    mostrarAlertas();
}

function mostrarAlertas(){
    const d = datosMes();
    const gastos = totalGastos();
    let html = "";
    if(d.presupuesto > 0){
        if(gastos > d.presupuesto){
            html += `<div class="alerta">⚠ ${t("Superaste el presupuesto por {m}.", {m: dinero(gastos - d.presupuesto)})}</div>`;
        }else if(gastos >= d.presupuesto * 0.8){
            const pct = Math.round(gastos / d.presupuesto * 100);
            html += `<div class="alerta warn">⚠ ${t("Ya usaste el {p}% del presupuesto.", {p: pct})}</div>`;
        }
    }
    if(d.ingreso > 0 && gastos > d.ingreso){
        html += `<div class="alerta">🚨 ${t("Tus gastos superan tu ingreso por {m}.", {m: dinero(gastos - d.ingreso)})}</div>`;
    }
    $("alertas").innerHTML = html;
}

function actualizarDashboard(){
    const d = datosMes();
    const gastos = totalGastos();
    const saldo = d.ingreso - gastos;
    const deudaTotal = deudas.reduce((s,x) => s + num(x.saldo), 0);
    $("lblIngreso").textContent = dinero(d.ingreso);
    $("lblGastos").textContent = dinero(gastos);
    $("lblSaldo").textContent = dinero(saldo);
    $("lblDeudaTotal").textContent = dinero(deudaTotal);
    $("lblSaldo").style.color = saldo < 0 ? "#991b1b" : "";
}

/* ===== Captura rápida (una categoría variable por pantalla) ===== */
function actualizarGasto(id, valor){
    datosMes().gastos[id] = num(valor);
    guardar();
    cargarTabla();
    actualizarDashboard();
}

function guardarCapturaActual(){
    const c = listaCaptura[categoriaActual];
    if(c) actualizarGasto(c.id, $("montoCategoriaCaptura").value);
}

function abrirCapturaRapida(){
    listaCaptura = categorias.filter(c => c.tipo === "variable");
    if(!listaCaptura.length){
        alert(t("No hay categorías variables. Las fijas se calculan automáticamente."));
        return;
    }
    categoriaActual = 0;
    $("modalCaptura").style.display = "block";
    mostrarCategoria();
}

function mostrarCategoria(){
    const c = listaCaptura[categoriaActual];
    $("contadorCategoria").textContent = t("Categoría {i} de {n}", {i: categoriaActual + 1, n: listaCaptura.length});
    $("nombreCategoriaCaptura").textContent = c.nombre;
    const actual = num(datosMes().gastos[c.id]);
    $("montoCategoriaCaptura").value = actual || "";
    $("btnSiguiente").textContent = categoriaActual === listaCaptura.length - 1 ? t("Finalizar ✔") : t("Siguiente →");
    $("montoCategoriaCaptura").focus();
}

function categoriaAnterior(){
    guardarCapturaActual();
    if(categoriaActual > 0){ categoriaActual--; mostrarCategoria(); }
}

function categoriaSiguiente(){
    guardarCapturaActual();
    if(categoriaActual < listaCaptura.length - 1){
        categoriaActual++;
        mostrarCategoria();
    }else{
        cerrarCaptura();
    }
}

function cerrarCaptura(){
    guardarCapturaActual();
    $("modalCaptura").style.display = "none";
}

/* ===== Inicio (lo llama core.js al iniciar sesión) ===== */
let listo = false;
window.iniciarApp = function(uid){
    K = uid + ":";
    // Migra datos locales de la versión anterior (sin cuenta), una sola vez
    if(!localStorage.getItem(K + "categorias") && localStorage.getItem("categorias")){
        ["categorias","datos","deudas","actualizado"].forEach(c => {
            const v = localStorage.getItem(c);
            if(v !== null) localStorage.setItem(K + c, v);
        });
    }
    categorias = leer("categorias", []);
    datos = leer("datos", {});
    deudas = leer("deudas", []);
    if(!localStorage.getItem(K + "actualizado") &&
       (categorias.length || deudas.length || Object.keys(datos).length)){
        localStorage.setItem(K + "actualizado", String(Date.now()));
    }
    if(!listo){
        $("mes").addEventListener("change", () => {
            localStorage.setItem("mesSeleccionado", $("mes").value);
            cargarMes();
        });
        $("ingreso").addEventListener("input", guardarInfoMes);
        $("presupuesto").addEventListener("input", guardarInfoMes);
        $("montoCategoriaCaptura").addEventListener("keydown", e => { if(e.key === "Enter") categoriaSiguiente(); });
        listo = true;
    }
    if(!$("mes").value) $("mes").value = localStorage.getItem("mesSeleccionado") || new Date().toISOString().slice(0,7);
    cargarCategorias();
    cargarDeudas();
    cargarMes();
};
window.cerrarApp = function(){
    K = ""; categorias = []; datos = {}; deudas = [];
    cerrarCategorias(); $("modalCaptura").style.display = "none";
};
