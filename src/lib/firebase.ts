// Import the functions you need from the SDKs you need
import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration should come from environment variables.
// Do NOT commit real keys to the repo. Use the `.env.example` as a template.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only when a key is present to avoid build-time crashes.
let appInstance: ReturnType<typeof initializeApp> | undefined = undefined;
if (firebaseConfig.apiKey) {
    appInstance = initializeApp(firebaseConfig as any);
}

export const storage = appInstance ? getStorage(appInstance) : undefined;

// Note: Ensure your Firebase Storage Rules allow writes from the client.
// For development you can set:
// service firebase.storage {
//   match /b/{bucket}/o {
//     match /{allPaths=**} {
//       allow read, write: if true; // NOT for production
//     }
//   }
// }
// For production require auth: allow read, write: if request.auth != null;