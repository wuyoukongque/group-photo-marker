import type { Person } from "@/types";

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

async function getFaceApi() {
  const faceapi = await import("@vladmandic/face-api");
  return faceapi;
}

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const faceapi = await getFaceApi();
    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return loadPromise;
}

/**
 * Compute 128-d face descriptor for a cropped face image
 */
export async function computeDescriptorFromCanvas(
  canvas: HTMLCanvasElement
): Promise<Float32Array | null> {
  const faceapi = await getFaceApi();
  await loadModels();

  const detection = await faceapi
    .detectSingleFace(canvas)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

/**
 * Crop a face from the source image and compute its descriptor
 */
export async function computeDescriptorForPerson(
  img: HTMLImageElement,
  person: Person,
  naturalW: number,
  naturalH: number
): Promise<number[] | null> {
  // Crop the face region with some padding
  const cx = person.x * naturalW;
  const cy = person.y * naturalH;
  const r = person.radius * naturalW;
  const padding = r * 0.3;

  const sx = Math.max(0, cx - r - padding);
  const sy = Math.max(0, cy - r - padding);
  const sw = Math.min(r * 2 + padding * 2, naturalW - sx);
  const sh = Math.min(r * 2 + padding * 2, naturalH - sy);

  const cropCanvas = document.createElement("canvas");
  const cropSize = 200; // Large enough for face-api.js
  cropCanvas.width = cropSize;
  cropCanvas.height = cropSize;
  const ctx = cropCanvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropSize, cropSize);

  const descriptor = await computeDescriptorFromCanvas(cropCanvas);
  return descriptor ? Array.from(descriptor) : null;
}

/**
 * Batch compute descriptors for all persons
 */
export async function computeDescriptorsForPersons(
  img: HTMLImageElement,
  persons: Person[],
  naturalW: number,
  naturalH: number,
  onProgress?: (current: number, total: number) => void
): Promise<Person[]> {
  await loadModels();

  const result: Person[] = [];
  for (let i = 0; i < persons.length; i++) {
    onProgress?.(i + 1, persons.length);
    const person = persons[i];
    const descriptor = await computeDescriptorForPerson(
      img,
      person,
      naturalW,
      naturalH
    );
    result.push({ ...person, descriptor: descriptor ?? undefined });
  }
  return result;
}

/**
 * Euclidean distance between two descriptor vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}
