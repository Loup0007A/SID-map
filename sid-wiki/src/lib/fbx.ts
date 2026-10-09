import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Chargé à la demande (import dynamique) : ne pèse rien tant qu'on n'envoie pas de .fbx.

/** Les matériaux FBX (Phong/Lambert) deviennent des matériaux PBR standard, que glTF sait représenter. */
function toStandard(m: THREE.Material): THREE.Material {
  const src = m as any;
  if (src.isMeshStandardMaterial || src.isMeshBasicMaterial) return m;
  const out = new THREE.MeshStandardMaterial({
    name: src.name,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: src.emissiveMap ?? null,
    emissiveIntensity: src.emissiveIntensity ?? 1,
    normalMap: src.normalMap ?? null,
    aoMap: src.aoMap ?? null,
    alphaMap: src.alphaMap ?? null,
    opacity: src.opacity ?? 1,
    transparent: !!src.transparent,
    alphaTest: src.alphaTest ?? 0,
    side: src.side ?? THREE.FrontSide,
    metalness: 0,
    roughness: 0.8,
  });
  return out;
}

/** Les textures intégrées au FBX se chargent en différé : on attend qu'elles soient prêtes (5 s max). */
async function waitTextures(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) for (const v of Object.values(m as any)) if (v && (v as any).isTexture) textures.add(v as THREE.Texture);
  });
  const ready = (t: THREE.Texture) => {
    const img = t.image as any;
    return !!img && (img.complete === undefined || img.complete) && (img.naturalWidth ?? img.width ?? 1) > 0;
  };
  const start = Date.now();
  while (Date.now() - start < 5000 && [...textures].some((t) => !ready(t))) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Convertit un .fbx (avec animations et textures intégrées) en .glb, dans le navigateur. */
export async function fbxToGlb(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const group = new FBXLoader().parse(buffer, '');

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as any).isSkinnedMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toStandard) : toStandard(mesh.material);
  });
  await waitTextures(group);

  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    new GLTFExporter().parse(
      group,
      (r) => (r instanceof ArrayBuffer ? resolve(r) : reject(new Error('export non binaire'))),
      (e) => reject(e instanceof Error ? e : new Error(String(e))),
      { binary: true, animations: group.animations, onlyVisible: false, maxTextureSize: 2048 }
    );
  });
  return new Uint8Array(result);
}
