"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Person, FaceMatchResult } from "@/types";

interface FaceDetectorProps {
  imageDataUrl: string;
  persons: Person[];
  onPersonsDetected: (persons: Person[]) => void;
  onPersonSelect: (id: string) => void;
  selectedPersonId: string | null;
  showNames: boolean;
  enableMatching?: boolean;
}

interface DetectedFace {
  cx: number;
  cy: number;
  width: number;
  height: number;
  score: number;
  hasValidKeypoints: boolean;
}

function deduplicateFaces(faces: DetectedFace[], threshold: number): DetectedFace[] {
  const result: DetectedFace[] = [];
  for (const face of faces) {
    const isDuplicate = result.some((existing) => {
      const dist = Math.sqrt(
        (face.cx - existing.cx) ** 2 + (face.cy - existing.cy) ** 2
      );
      return dist < threshold;
    });
    if (!isDuplicate) {
      result.push(face);
    }
  }
  return result;
}

export default function FaceDetector({
  imageDataUrl,
  persons,
  onPersonsDetected,
  onPersonSelect,
  selectedPersonId,
  showNames,
  enableMatching = true,
}: FaceDetectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const detectImgRef = useRef<HTMLImageElement | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);
  const [matchingStatus, setMatchingStatus] = useState("");
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Calculate display size (responsive to container width)
  useEffect(() => {
    if (!imgSize.w || !containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const scale = Math.min(1, containerWidth / imgSize.w);
      setDisplaySize({
        w: Math.round(imgSize.w * scale),
        h: Math.round(imgSize.h * scale),
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imgSize]);

  // Draw canvas with high DPI support
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !displaySize.w) return;

    // Use device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displaySize.w * dpr;
    canvas.height = displaySize.h * dpr;
    canvas.style.width = `${displaySize.w}px`;
    canvas.style.height = `${displaySize.h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    ctx.drawImage(img, 0, 0, displaySize.w, displaySize.h);

    const scale = displaySize.w / imgSize.w;

    persons.forEach((person) => {
      const cx = person.x * imgSize.w * scale;
      const cy = person.y * imgSize.h * scale;
      const r = person.radius * imgSize.w * scale;

      const isSelected = person.id === selectedPersonId;

      // Draw circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? "#4361ee" : "rgba(255,255,255,0.85)";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Draw shadow for better visibility
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw name label
      if (showNames && person.name) {
        const label = person.name;
        ctx.font = `${Math.max(12, r * 0.4)}px -apple-system, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const labelX = cx - textWidth / 2;
        const labelY = cy + r + Math.max(16, r * 0.5);

        // Background
        ctx.fillStyle = isSelected
          ? "rgba(67,97,238,0.85)"
          : "rgba(0,0,0,0.6)";
        const padding = 4;
        ctx.beginPath();
        ctx.roundRect(
          labelX - padding,
          labelY - Math.max(12, r * 0.4) - padding / 2,
          textWidth + padding * 2,
          Math.max(12, r * 0.4) + padding * 2,
          4
        );
        ctx.fill();

        // Text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, labelX, labelY);
      }
    });
  }, [persons, displaySize, imgSize, selectedPersonId, showNames]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Face detection using MediaPipe with tile-based approach for group photos
  const detectFaces = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;

    setDetecting(true);

    try {
      const { FaceDetector: MPFaceDetector, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const detector = await MPFaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.45,
      });

      const allFaces: DetectedFace[] = [];
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      // Create a hidden image element in DOM for MediaPipe (it needs a DOM element)
      const detectImg = document.createElement("img");
      detectImg.style.position = "fixed";
      detectImg.style.left = "-9999px";
      detectImg.style.top = "-9999px";
      document.body.appendChild(detectImg);
      detectImgRef.current = detectImg;

      // Helper: detect faces on a canvas region
      const detectOnCanvas = async (
        srcCanvas: HTMLCanvasElement,
        offsetX: number,
        offsetY: number,
        scaleBack: number
      ) => {
        return new Promise<void>((resolve) => {
          detectImg.onload = () => {
            try {
              const result = detector.detect(detectImg);
              for (const det of result.detections) {
                const box = det.boundingBox!;
                const score = det.categories?.[0]?.score ?? 0;

                // Validate keypoints: MediaPipe blaze_face returns 6 keypoints:
                // 0: right eye, 1: left eye, 2: nose tip, 3: mouth center,
                // 4: right ear, 5: left ear
                // A real face should have eyes ABOVE mouth, and eyes roughly horizontally aligned
                let hasValidKeypoints = false;
                const kps = det.keypoints;
                if (kps && kps.length >= 4) {
                  const rightEye = kps[0];
                  const leftEye = kps[1];
                  const nose = kps[2];
                  const mouth = kps[3];

                  // Eyes should be above nose, nose above mouth (y increases downward)
                  const eyeY = (rightEye.y + leftEye.y) / 2;
                  const eyesAboveMouth = eyeY < mouth.y;
                  const noseInMiddle = nose.y > eyeY && nose.y < mouth.y + 0.05;

                  // Eyes should be roughly at the same height (within 30% of box height)
                  const eyeYDiff = Math.abs(rightEye.y - leftEye.y);
                  const eyesAligned = eyeYDiff < 0.3;

                  // Eyes should be horizontally separated
                  const eyeXDiff = Math.abs(rightEye.x - leftEye.x);
                  const eyesSeparated = eyeXDiff > 0.1;

                  hasValidKeypoints = eyesAboveMouth && noseInMiddle && eyesAligned && eyesSeparated;
                }

                allFaces.push({
                  cx: (box.originX + box.width / 2) * scaleBack + offsetX,
                  cy: (box.originY + box.height / 2) * scaleBack + offsetY,
                  width: box.width * scaleBack,
                  height: box.height * scaleBack,
                  score,
                  hasValidKeypoints,
                });
              }
            } catch (e) {
              console.warn("Detection on tile failed:", e);
            }
            resolve();
          };
          detectImg.onerror = () => resolve();
          detectImg.src = srcCanvas.toDataURL("image/jpeg", 0.95);
        });
      };

      // Strategy: Two-pass tile detection
      // Pass 1: Full image (catches large/medium faces)
      // Pass 2: Medium tiles with overlap (catches smaller faces in group photos)
      // We avoid tiny tiles which cause too many false positives.

      const maxDim = Math.max(naturalW, naturalH);

      // Pass 1: Full image detection
      console.log("Pass 1: Full image");
      {
        const fullCanvas = document.createElement("canvas");
        // Downscale large images to ~1200px max dimension for full pass
        const fullScale = Math.min(1, 1200 / maxDim);
        fullCanvas.width = Math.round(naturalW * fullScale);
        fullCanvas.height = Math.round(naturalH * fullScale);
        const fullCtx = fullCanvas.getContext("2d")!;
        fullCtx.imageSmoothingEnabled = true;
        fullCtx.imageSmoothingQuality = "high";
        fullCtx.drawImage(img, 0, 0, fullCanvas.width, fullCanvas.height);
        await detectOnCanvas(fullCanvas, 0, 0, 1 / fullScale);
      }

      // Pass 2: Tile-based detection for group photos
      if (maxDim > 1500) {
        // Target tile size ~500px from source, covering ~3-5 faces each
        // Use sliding window with 30% overlap
        const targetTile = 500;
        const tileCols = Math.max(2, Math.round(naturalW / targetTile));
        const tileRows = Math.max(2, Math.round(naturalH / targetTile));
        const tileW = naturalW / tileCols;
        const tileH = naturalH / tileRows;
        const overlapW = tileW * 0.3;
        const overlapH = tileH * 0.3;

        console.log(`Pass 2: tile grid ${tileCols}x${tileRows}`);

        for (let row = 0; row < tileRows; row++) {
          for (let col = 0; col < tileCols; col++) {
            const sx = Math.max(0, col * tileW - overlapW);
            const sy = Math.max(0, row * tileH - overlapH);
            const sw = Math.min(tileW + overlapW * 2, naturalW - sx);
            const sh = Math.min(tileH + overlapH * 2, naturalH - sy);

            const tileCanvas = document.createElement("canvas");
            // Upscale so the tile is ~600px - enough for MediaPipe without amplifying noise
            const upscale = Math.max(1, 600 / Math.max(sw, sh));
            tileCanvas.width = Math.round(sw * upscale);
            tileCanvas.height = Math.round(sh * upscale);
            const tileCtx = tileCanvas.getContext("2d")!;
            tileCtx.imageSmoothingEnabled = true;
            tileCtx.imageSmoothingQuality = "high";
            tileCtx.drawImage(
              img,
              sx, sy, sw, sh,
              0, 0, tileCanvas.width, tileCanvas.height
            );

            await detectOnCanvas(tileCanvas, sx, sy, 1 / upscale);
          }
        }
      }

      // Clean up DOM element
      document.body.removeChild(detectImg);
      detectImgRef.current = null;

      // Soft keypoint filter: valid keypoints = keep at lower score, invalid = need higher score
      const minFaceSize = naturalW * 0.012;
      const maxFaceSize = naturalW * 0.25;
      const sizeFiltered = allFaces.filter((f) => {
        const size = Math.max(f.width, f.height);
        if (size < minFaceSize || size > maxFaceSize) return false;
        const ratio = f.width / f.height;
        if (ratio < 0.5 || ratio > 2.0) return false;
        // Soft filter: if keypoints look like a face, accept score >= 0.45
        // If keypoints are invalid/missing, require higher score >= 0.65
        if (f.hasValidKeypoints) return f.score >= 0.45;
        return f.score >= 0.65;
      });

      // Step 3: Deduplicate - keep the higher-score detection when merging
      const avgFaceWidth = sizeFiltered.length > 0
        ? sizeFiltered.reduce((sum, f) => sum + f.width, 0) / sizeFiltered.length
        : naturalW * 0.03;
      const dedupeThreshold = avgFaceWidth * 0.6;
      // Sort by score descending so dedup keeps best detection
      sizeFiltered.sort((a, b) => b.score - a.score);
      const uniqueFaces = deduplicateFaces(sizeFiltered, dedupeThreshold);

      // Step 4: Filter outlier sizes - faces in a group photo are similar sizes
      // Remove faces that are <30% of the median size (likely false positives)
      if (uniqueFaces.length > 3) {
        const sizes = uniqueFaces.map((f) => Math.max(f.width, f.height)).sort((a, b) => a - b);
        const medianSize = sizes[Math.floor(sizes.length / 2)];
        const minAllowed = medianSize * 0.3;
        const finalFaces = uniqueFaces.filter((f) => Math.max(f.width, f.height) >= minAllowed);
        uniqueFaces.length = 0;
        uniqueFaces.push(...finalFaces);
      }

      console.log(`Detected ${allFaces.length} raw → ${sizeFiltered.length} filtered → ${uniqueFaces.length} final`);

      const newPersons: Person[] = uniqueFaces.map((face, i) => {
        const cx = face.cx / naturalW;
        const cy = face.cy / naturalH;
        const radius =
          (Math.max(face.width, face.height) * 0.75) / naturalW;

        return {
          id: `person-${Date.now()}-${i}`,
          name: "",
          bio: "",
          x: cx,
          y: cy,
          radius,
        };
      });

      // Sort by position: top to bottom, left to right
      newPersons.sort((a, b) => {
        const rowDiff = Math.abs(a.y - b.y);
        if (rowDiff < 0.08) {
          return a.x - b.x;
        }
        return a.y - b.y;
      });

      // First pass: show detected persons immediately
      onPersonsDetected(newPersons);
      setDetected(true);
      detector.close();

      // Second pass: compute descriptors and match against face library
      if (enableMatching && newPersons.length > 0) {
        setMatchingStatus("正在计算人脸特征...");
        try {
          const { computeDescriptorsForPersons } = await import("@/lib/faceDescriptor");
          const personsWithDescriptors = await computeDescriptorsForPersons(
            img,
            newPersons,
            naturalW,
            naturalH,
            (current, total) => {
              setMatchingStatus(`正在计算人脸特征 (${current}/${total})...`);
            }
          );

          // Match against library
          const descriptors = personsWithDescriptors.map((p) => p.descriptor || null);
          const validDescriptors = descriptors.filter((d): d is number[] => d !== null);

          if (validDescriptors.length > 0) {
            setMatchingStatus("正在匹配人脸库...");
            const matchRes = await fetch("/api/faces/match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ descriptors }),
            });
            const { matches } = await matchRes.json();

            // Apply matches to persons
            const matchedPersons = personsWithDescriptors.map((person, i) => {
              const match = matches[i] as FaceMatchResult | null;
              if (match) {
                return {
                  ...person,
                  name: match.name,
                  bio: match.bio,
                  libraryEntryId: match.libraryEntryId,
                };
              }
              return person;
            });

            const matchCount = matches.filter((m: unknown) => m !== null).length;
            if (matchCount > 0) {
              setMatchingStatus(`已自动匹配 ${matchCount} 人`);
            } else {
              setMatchingStatus("");
            }
            onPersonsDetected(matchedPersons);
          } else {
            setMatchingStatus("");
            onPersonsDetected(personsWithDescriptors);
          }
        } catch (err) {
          console.warn("Face matching failed:", err);
          setMatchingStatus("");
        }
      }
    } catch (err) {
      console.error("Face detection failed:", err);
      alert("人脸检测失败，请重试");
    } finally {
      setDetecting(false);
    }
  }, [onPersonsDetected, enableMatching]);

  // Auto detect on mount — skip if persons already loaded from server
  useEffect(() => {
    if (imgSize.w > 0 && !detected && !detecting && persons.length === 0) {
      detectFaces();
    }
  }, [imgSize, detected, detecting, detectFaces]);

  // Clean up hidden img on unmount
  useEffect(() => {
    return () => {
      if (detectImgRef.current && detectImgRef.current.parentNode) {
        detectImgRef.current.parentNode.removeChild(detectImgRef.current);
      }
    };
  }, []);

  // Handle click on canvas to select person
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const scale = displaySize.w / imgSize.w;

      // Find clicked person
      for (const person of persons) {
        const cx = person.x * imgSize.w * scale;
        const cy = person.y * imgSize.h * scale;
        const r = person.radius * imgSize.w * scale;
        const dist = Math.sqrt((clickX - cx) ** 2 + (clickY - cy) ** 2);
        if (dist <= r * 1.2) {
          onPersonSelect(person.id);
          return;
        }
      }
    },
    [persons, displaySize, imgSize, onPersonSelect]
  );

  // Handle manual add face via double click
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const scale = displaySize.w / imgSize.w;

      const x = clickX / (imgSize.w * scale);
      const y = clickY / (imgSize.h * scale);
      const radius = 0.03;

      const newPerson: Person = {
        id: `person-${Date.now()}`,
        name: "",
        bio: "",
        x,
        y,
        radius,
      };

      onPersonsDetected([...persons, newPerson]);
    },
    [persons, displaySize, imgSize, onPersonsDetected]
  );

  return (
    <div ref={containerRef} className="w-full">
      {detecting && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent mb-3"></div>
          <p className="text-gray-500">AI 正在识别人脸...</p>
        </div>
      )}
      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleDoubleClick}
          className="rounded-lg cursor-pointer max-w-full"
        />
      </div>
      {detected && (
        <div className="mt-2">
          <p className="text-xs text-gray-400">
            已识别 {persons.length} 人 · 双击空白处可手动添加 · 点击圆圈选中编辑
          </p>
          {matchingStatus && (
            <p className="text-xs text-[var(--primary)] mt-1">{matchingStatus}</p>
          )}
        </div>
      )}
    </div>
  );
}
