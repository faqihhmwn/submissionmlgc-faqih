const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const { savePrediction } = require('./predictionHandler'); // Perubahan nama file
const { firestoreDatabase } = require('./firebaseConfig'); // Perubahan nama file
const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');
const path = require('path');
const sharp = require('sharp');

const app = express();
const SERVER_PORT = process.env.PORT || 3000; // Perubahan nama konstanta

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Multer setup
const memoryStorage = multer.memoryStorage();
const fileUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // Maksimal ukuran file 1MB
  fileFilter: (req, file, callback) => {
    const supportedTypes = ['image/jpeg', 'image/png'];
    if (!supportedTypes.includes(file.mimetype)) {
      return callback(new Error('Only .png and .jpeg are allowed!'));
    }
    callback(null, true);
  },
});

// Load model from Cloud Storage
const MODEL_PATH = 'https://storage.googleapis.com/ml-bucket-storage1/model/model.json';
let predictionModel;

(async () => {
  predictionModel = await tf.loadGraphModel(MODEL_PATH);
  console.log('Model successfully loaded!');
})();

// POST /predict
app.post('/predict', fileUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi',
      });
    }

    // Verifikasi format gambar menggunakan sharp
    const uploadedImage = sharp(req.file.buffer);
    const imageMetadata = await uploadedImage.metadata();

    // Pastikan gambar memiliki 3 channel warna (RGB)
    if (imageMetadata.channels !== 3) {
      return res.status(400).json({
        status: 'fail',
        message: 'Terjadi kesalahan dalam melakukan prediksi',
      });
    }

    // Preprocess image
    const imageBuffer = req.file.buffer;
    const decodedTensor = tf.node.decodeImage(imageBuffer, 3);

    // Resize dan buat tensor input untuk model
    const resizedTensor = tf.image.resizeBilinear(decodedTensor, [224, 224]);
    const inputModelTensor = resizedTensor.expandDims(0).div(255.0);

    // Predict
    const modelPrediction = await predictionModel.predict(inputModelTensor).data();
    const isCancerDetected = modelPrediction[0] > 0.58;

    // Response message
    const predictionResult = isCancerDetected ? 'Cancer' : 'Non-cancer';
    const healthAdvice = isCancerDetected
      ? 'Segera periksa ke dokter!'
      : 'Penyakit kanker tidak terdeteksi.';

    // Save to Firestore
    const documentRef = await savePrediction(null, predictionResult, healthAdvice, modelPrediction[0]);

    res.status(201).json({
      status: 'success',
      message: 'Model is predicted successfully',
      data: {
        id: documentRef.id,
        result: predictionResult,
        suggestion: healthAdvice,
        createdAt: new Date().toISOString(), // Tambahkan field createdAt
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(400).json({
      status: 'fail',
      message: 'Terjadi kesalahan dalam melakukan prediksi',
    });
  }
});

// Handle file size error
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'fail',
      message: 'Payload content length greater than maximum allowed: 1000000',
    });
  }
  next(err);
});

// GET /predict/histories
app.get('/predict/histories', async (req, res) => {
  try {
    const predictionSnapshots = await firestoreDatabase.collection('predictions').get();
    const predictionHistories = predictionSnapshots.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Mengirimkan respons dengan status dan data yang benar
    res.status(200).json({
      status: 'success', // Menambahkan status 'success'
      data: predictionHistories, // Mengirimkan array riwayat prediksi dalam 'data'
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      status: 'fail', // Status fail jika ada error dalam mengambil data
      message: 'Failed to fetch histories!',
    });
  }
});

// Start server
app.listen(SERVER_PORT, () => {
  console.log(`Server is running on port ${SERVER_PORT}`);
});
