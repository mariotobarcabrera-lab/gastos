/* NÚCLEO REUTILIZABLE: login, sincronización por usuario e instalación PWA.
   La app debe definir window.iniciarApp(uid), window.cerrarApp(), window.obtenerEstado()
   y window.aplicarDatosNube(datos, fecha), y llamar a window.nubeSubir() al guardar. */
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signOut, sendEmailVerification, sendPasswordResetEmail}
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, onSnapshot}
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig} from "./config.js";

const $ = id => document.getElementById(id);
const show = (id, v) => $(id).classList.toggle("hidden", !v);
const msg = t => { $("msg").textContent = t || ""; };

/* ---- PWA: service worker + botón de instalar ---- */
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
let instalador = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); instalador = e; show("btnInstall", true); });
$("btnInstall").onclick = async () => {
    if(!instalador) return;
    instalador.prompt(); await instalador.userChoice;
    instalador = null; show("btnInstall", false);
};
if(/iphone|ipad/i.test(navigator.userAgent) && !navigator.standalone) show("iosHint", true);

/* ---- Modo local si aún no se configuró Firebase ---- */
if(Object.values(firebaseConfig).some(v => String(v).startsWith("PEGA_AQUI"))){
    $("verifMsg").textContent = t("Modo local: configura config.js para activar cuentas y sincronización.");
    show("verifMsg", true); show("appBox", true);
    window.iniciarApp("local");
}else{
    iniciar();
}

function iniciar(){
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    let db;
    try{ db = initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})}); }
    catch(e){ db = getFirestore(app); }
    let ref = null, anular = null, temporizador = null;

    const errores = {
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/invalid-email": "El correo no es válido.",
        "auth/email-already-in-use": "Ese correo ya tiene cuenta. Usa Entrar.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/missing-password": "Escribe la contraseña.",
        "auth/too-many-requests": "Demasiados intentos. Espera un momento."
    };
    const fallo = e => msg("⚠ " + (errores[e.code] ? t(errores[e.code]) : t("No se pudo completar la acción ({c}).", {c: e.code || e.message})));
    const datosForm = () => [$("email").value.trim(), $("pass").value];

    $("btnLogin").onclick = () => { msg(""); signInWithEmailAndPassword(auth, ...datosForm()).catch(fallo); };
    $("pass").addEventListener("keydown", e => { if(e.key === "Enter") $("btnLogin").click(); });
    $("btnRegister").onclick = async () => {
        msg("");
        try{
            const c = await createUserWithEmailAndPassword(auth, ...datosForm());
            sendEmailVerification(c.user).catch(() => {});
        }catch(e){ fallo(e); }
    };
    $("btnReset").onclick = e => {
        e.preventDefault();
        const correo = $("email").value.trim();
        if(!correo){ msg(t("Escribe tu correo y pulsa de nuevo.")); return; }
        sendPasswordResetEmail(auth, correo).then(() => msg(t("Si el correo existe, recibirás un mensaje para cambiar la contraseña."))).catch(fallo);
    };
    $("btnLogout").onclick = () => signOut(auth);
    $("btnVerif").onclick = async () => {
        const u = auth.currentUser; if(!u) return;
        try{
            await sendEmailVerification(u);
            $("verifTxt").textContent = t("Te enviamos un correo a {e}. Revisa también la carpeta de spam.", {e: u.email});
        }catch(e){
            $("verifTxt").textContent = "⚠ " + (e.code === "auth/too-many-requests" ? t("Demasiados intentos. Espera un momento.")
                : t("No se pudo completar la acción ({c}).", {c: e.code || e.message}));
        }
    };
    $("btnVerifOk").onclick = async () => {
        const u = auth.currentUser; if(!u) return;
        try{ await u.reload(); }catch(e){}
        if(u.emailVerified) show("verifBox", false);
        else $("verifTxt").textContent = t("Aún no aparece verificado. Abre el enlace del correo y vuelve a pulsar.");
    };

    async function subirAhora(){
        if(!ref) return;
        const s = window.obtenerEstado();
        try{
            await setDoc(ref, {json: JSON.stringify({categorias: s.categorias, datos: s.datos, deudas: s.deudas}), actualizado: s.actualizado});
        }catch(err){ $("verifMsg").textContent = "⚠ " + t("No se pudo sincronizar ({c}).", {c: err.code || err.message}); show("verifMsg", true); }
    }
    window.nubeSubir = () => { if(!ref) return; clearTimeout(temporizador); temporizador = setTimeout(subirAhora, 800); };

    onAuthStateChanged(auth, user => {
        if(anular){ anular(); anular = null; }
        ref = null; clearTimeout(temporizador);
        if(!user){
            window.cerrarApp();
            show("appBox", false); show("userBar", false); show("verifMsg", false); show("verifBox", false); show("authCard", true);
            $("pass").value = "";
            return;
        }
        show("authCard", false); show("userBar", true); show("appBox", true);
        $("userEmail").textContent = "☁ " + user.email;
        show("verifMsg", false);
        $("verifTxt").textContent = t("Tu correo aún no está verificado.");
        show("verifBox", !user.emailVerified);
        window.iniciarApp(user.uid);
        ref = doc(db, "usuarios", user.uid);
        anular = onSnapshot(ref, snap => {
            if(snap.metadata.hasPendingWrites) return;
            const local = window.obtenerEstado();
            if(!snap.exists()){ subirAhora(); return; }
            const nube = snap.data();
            if((nube.actualizado || 0) > local.actualizado){
                try{ window.aplicarDatosNube(JSON.parse(nube.json), nube.actualizado || 0); }catch(e){ console.error(e); }
            }else if((nube.actualizado || 0) < local.actualizado){
                subirAhora();
            }
        }, err => { $("verifMsg").textContent = "⚠ " + t("Error de sincronización ({c}).", {c: err.code || err.message}); show("verifMsg", true); });
    });
}
