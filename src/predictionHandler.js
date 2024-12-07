const { firestoreDatabase } = require('./firebaseConfig'); 

/**
 * Fungsi untuk menyimpan data hasil prediksi ke dalam Firestore.
 * @param {string|null} documentId - ID dokumen prediksi (biarkan null untuk auto-generate ID)
 * @param {string} predictionResult - Hasil prediksi ('cancer' atau 'non-cancer')
 * @param {string} recommendation - Rekomendasi berdasarkan hasil prediksi
 * @param {number} modelConfidence - Nilai confidence dari model (contoh: antara 0-1)
 * @returns {Promise<Object>} - Referensi dokumen yang disimpan
 */
async function savePrediction(documentId, predictionResult, recommendation, modelConfidence) {
  try {
    const predictionPayload = {
      id: documentId,
      result: predictionResult,
      suggestion: recommendation,
      confidence: modelConfidence,
      createdAt: new Date().toISOString(),
    };

    // Jika documentId tidak diberikan, buat dokumen baru dengan ID yang di-generate otomatis
    let documentReference;
    if (!documentId) {
      documentReference = await firestoreDatabase.collection('predictions').add(predictionPayload);
      // Perbarui dokumen dengan ID yang telah di-generate
      await documentReference.update({ id: documentReference.id });
    } else {
      documentReference = firestoreDatabase.collection('predictions').doc(documentId);
      await documentReference.set(predictionPayload);
    }

    return documentReference; // Kembalikan referensi dokumen yang telah disimpan
  } catch (error) {
    console.error('Error while saving prediction:', error);
    throw new Error('Unable to save prediction data');
  }
}

module.exports = { savePrediction };
