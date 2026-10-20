// Detection and recognition are separate: locate faces cheaply, then compute
// a descriptor only for a single, sufficiently large face. All work is local.
export function minimumFaceSize(input) {
  const width = input.width || input.videoWidth || input.shape?.[1] || 960;
  const height = input.height || input.videoHeight || input.shape?.[0] || 960;
  return Math.max(width, height) * 70 / 960;
}

export async function detectFacesForComparison(faceapi, input, { isDemo = false, loadFallback = async () => {} } = {}) {
  let detections;
  if (!isDemo) {
    detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .4 }));
    // A larger pass can recover small or less clearly lit faces. The heavier
    // detector remains available for difficult photographs and painted demos.
    if (!detections.length) detections = await faceapi.detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: .35 }));
  }
  if (isDemo || !detections.length) {
    await loadFallback();
    detections = await faceapi.detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: isDemo ? .2 : .4, maxResults: 8 }));
  }
  const faces = detections.map(detection => ({ detection }));
  if (faces.length !== 1) return faces;
  const box = faces[0].detection.box;
  if (!isDemo && (box.width < minimumFaceSize(input) || box.height < minimumFaceSize(input))) return faces;
  // Reuse the completed detection instead of running the detector a second
  // time through a fresh detectAllFaces(...).withFaceLandmarks() chain.
  return new faceapi.DetectAllFaceLandmarksTask(Promise.resolve(faces), input, false).withFaceDescriptors();
}

export async function warmFaceModels(faceapi) {
  // WebGL compiles shaders on their first use. Move that one-time work before
  // the photograph. CPU has no shader compilation, so avoid a redundant run.
  if (faceapi.tf.getBackend() !== 'webgl') return;
  const sample = faceapi.tf.zeros([160, 160, 3]);
  try {
    await faceapi.detectAllFaces(sample, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: .4 }));
    await faceapi.nets.faceLandmark68Net.detectLandmarks(sample);
    await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(sample);
  } finally { sample.dispose(); }
}
