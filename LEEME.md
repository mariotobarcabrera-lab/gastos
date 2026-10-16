# Plantilla de app con cuentas, nube e instalación (PWA)

## Archivos
- `index.html` y `app.js`: la app (control financiero). Para una app nueva, cambia solo estos dos.
- `core.js`: login, sincronización por usuario e instalación. Se reutiliza tal cual.
- `config.js`: datos de tu proyecto Firebase (reemplaza los `PEGA_AQUI`).
- `sw.js`, `manifest.webmanifest`, `icons/`: lo que hace la app instalable y disponible sin conexión.

## Puesta en marcha
1. En Firebase activa **Authentication > Correo/contraseña** y **Firestore** (reglas abajo).
2. Pega tus datos en `config.js`.
3. Sube **todos los archivos y la carpeta `icons`** a tu repositorio de GitHub (descomprime el ZIP antes) y activa Pages.
4. Dominio propio: en GitHub, Settings > Pages > Custom domain; en tu registrador crea el registro DNS que GitHub indique.
   Después agrega el dominio en Firebase > Authentication > Configuración > Dominios autorizados.
5. Al publicar una versión nueva, cambia el número de `CACHE` en `sw.js` para que los usuarios la reciban.

## Reglas de Firestore
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Idiomas
La app usa el idioma del navegador o del sistema: español (base), inglés, portugués y francés.
Si el idioma del usuario no está disponible, se muestra en inglés. Para probar uno: `?lang=pt` en la URL.
Para añadir un idioma, agrega un bloque nuevo en `i18n.js` con las mismas claves.
La moneda sigue siendo USD; el formato de números y fechas se adapta al idioma.

## Instalar en el celular
- Android (Chrome): botón "Instalar app" o menú > Instalar aplicación.
- iPhone (Safari): Compartir > Añadir a pantalla de inicio.
