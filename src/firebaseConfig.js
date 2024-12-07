const firebaseAdmin = require('firebase-admin');
const serviceKey = require('./firebaseServiceKey.json'); // Path ke file kunci akun layanan Firebase

// Inisialisasi Firebase Admin SDK
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceKey), // Menggunakan credential dari service account key
  databaseURL: 'https://submissionmlgc-faqih.firebaseio.com' // Ganti dengan URL Firebase Database Anda
});

// Inisialisasi Firestore
const firestoreDatabase = firebaseAdmin.firestore();

// Ekspor objek firestoreDatabase untuk digunakan di file lain
module.exports = { firestoreDatabase };
