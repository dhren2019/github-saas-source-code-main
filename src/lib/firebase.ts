// Import the functions you need from the SDKs you need
import { getStorage } from "firebase/storage";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDDoVl4tgC1xBQlcvoOuv_vmDhYWQD7nQw",
    authDomain: "github-saas-d6499.firebaseapp.com",
    projectId: "github-saas-d6499",
    storageBucket: "github-saas-d6499.firebasestorage.app",
    messagingSenderId: "1003676191648",
    appId: "1:1003676191648:web:126201a61101dfd191b2c5",
    measurementId: "G-LST0W25197"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

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