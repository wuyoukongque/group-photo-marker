export interface Person {
  id: string;
  name: string;
  bio: string;
  // Face position relative to image (0-1 ratios)
  x: number;
  y: number;
  radius: number;
  descriptor?: number[];       // 128-d face descriptor for matching
  libraryEntryId?: string;     // linked face library entry
}

export interface ProjectData {
  title: string;
  imageDataUrl: string;
  persons: Person[];
  showNames: boolean;
}

export interface FaceLibraryEntry {
  id: string;
  name: string;
  bio: string;
  avatarDataUrl: string;       // cropped face image
  descriptor: number[];        // 128-d float array
  createdAt: string;
  updatedAt: string;
}

export interface FaceMatchResult {
  libraryEntryId: string;
  name: string;
  bio: string;
  distance: number;            // Euclidean distance (lower = better)
}
