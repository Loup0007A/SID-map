import { PropertyType, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

// Chargé à la demande (import dynamique) : ne pèse rien tant qu'on n'édite pas un modèle.
function io() {
  return new WebIO().registerExtensions(ALL_EXTENSIONS);
}

/** Même nom que celui vu par <model-viewer> / three.js (sans nom => animation_N). */
function animName(name: string, index: number) {
  return name || `animation_${index}`;
}

/** Extensions déclarées dans l'en-tête JSON d'un .glb (extensionsUsed). */
function extensionsOf(bytes: Uint8Array): string[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  return Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
}

export async function listAnimations(bytes: Uint8Array): Promise<string[]> {
  const doc = await io().readBinary(bytes);
  return doc
    .getRoot()
    .listAnimations()
    .map((a, i) => animName(a.getName(), i));
}

export type OptimizeResult = {
  bytes: Uint8Array;
  /** Extensions du fichier que l'outil ne sait pas conserver. Si non vide, `bytes` est le fichier d'origine, inchangé. */
  lost: string[];
};

/**
 * Allège un .glb exporté de Blender, SANS toucher aux matériaux ni aux textures :
 *  - ne garde QUE l'animation (« action ») choisie, supprime les autres ;
 *  - supprime les caméras ;
 *  - purge uniquement les données d'animation devenues orphelines.
 * Si le fichier utilise une extension que l'outil ne gère pas (elle serait perdue à l'écriture, ce qui peut
 * « blanchir » un matériau), le fichier d'origine est renvoyé tel quel avec la liste dans `lost`.
 */
export async function optimizeGlb(bytes: Uint8Array, keep: string | null): Promise<OptimizeResult> {
  const before = extensionsOf(bytes);
  const doc = await io().readBinary(bytes);
  const root = doc.getRoot();

  root.listAnimations().forEach((a, i) => {
    if (keep === null || animName(a.getName(), i) !== keep) a.dispose();
  });
  root.listCameras().forEach((c) => c.dispose());

  await doc.transform(prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER] }));
  const out = await io().writeBinary(doc);

  const after = extensionsOf(out);
  const lost = before.filter((e) => !after.includes(e));
  return lost.length ? { bytes, lost } : { bytes: out, lost: [] };
}
