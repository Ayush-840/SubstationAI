# SubstationIQ Mobile

Native iOS and Android companion app built with JavaScript, React Native, and Expo. The website remains in `frontend/`.

## Run it

```sh
cd mobile
npm install
npm start
```

Scan the QR code with Expo Go, or press `i` / `a` to open an installed simulator. Camera capture requires a device or simulator with camera support. Expo will request camera permission when the user opens the camera view.

The app opens directly into Demo Mode; no login is required to present the portal. It includes sample equipment and procedures so the main screens can be explored without a running server. Sample material is illustrative and should not be used to guide live field work.

The main app code is `App.js`. It uses normal JavaScript with JSX markup; TypeScript is not required.

If a valid session token is already saved, the app restores it and loads live equipment and tests. To connect a local server on a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP, such as `http://192.168.1.20:4000`; `localhost` on a phone points to the phone itself. Android emulator users can usually use `http://10.0.2.2:4000`.

The backend currently has no chat, fault diagnosis, DGA analysis, result comparison, or activity-history endpoints; the demo screens use sample catalog material or explain the missing capability.

## Screens

Ask, Procedures, Diagnose, DGA, Learn, History, Catalog, Result Checker, and Account. The Diagnose screen can open the native camera and attach a captured equipment photo to the form. Captures stay on device because the current backend has no image upload or diagnosis endpoint.
