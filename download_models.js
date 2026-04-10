import https from 'https';
import fs from 'fs';
import path from 'path';

const MODELS_DIR = './public/models';
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function download(file) {
  const url = `${BASE_URL}/${file}`;
  const dest = path.join(MODELS_DIR, file);
  
  https.get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Failed to download ${file}: ${res.statusCode}`);
      return;
    }
    const stream = fs.createWriteStream(dest);
    res.pipe(stream);
    stream.on('finish', () => {
      stream.close();
      console.log(`✓ Downloaded ${file}`);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${file}: ${err.message}`);
  });
}

console.log('Downloading models to public/models...');
files.forEach(download);
