import fs from 'fs';
import path from 'path';

const modelsUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const modelsDir = path.join(process.cwd(), 'public', 'models');

const filesToDownload = [
  'ssd_mobilenet_v1_model-weights_manifest.json',
  'ssd_mobilenet_v1_model-shard1',
  'ssd_mobilenet_v1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

async function downloadFile(file) {
  const filePath = path.join(modelsDir, file);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
    console.log(`${file} already exists, skipping.`);
    return;
  }
  
  console.log(`Downloading ${file}...`);
  const response = await fetch(modelsUrl + file);
  if (!response.ok) throw new Error(`Failed to download ${file}: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  console.log(`Finished ${file}`);
}

async function run() {
  try {
    for (const f of filesToDownload) {
      await downloadFile(f);
    }
    console.log("All models downloaded successfully!");
  } catch (err) {
    console.error("Error downloading models:", err);
    process.exit(1);
  }
}

run();
