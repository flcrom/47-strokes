import { validate } from "../src/core.mjs";
export const introPaths = [[[173.1,145],[207.2,145]],[[207.2,145],[223.94,157.0]],[[223.94,157.0],[235.1,175.0]],[[235.1,175.0],[235.1,215.0]],[[235.1,215.0],[223.94,233.0]],[[223.94,233.0],[207.2,245]],[[207.2,245],[173.1,245]],[[173.1,245],[173.1,145]],[[256.8,245],[256.8,145]],[[256.8,145],[300.2,145]],[[300.2,145],[318.8,165.0]],[[318.8,165.0],[318.8,180.0]],[[318.8,180.0],[300.2,195.0]],[[300.2,195.0],[256.8,195.0]],[[287.8,195.0],[318.8,245]],[[340.5,245],[371.5,145]],[[371.5,145],[402.5,245]],[[356.0,195.0],[387.0,195.0]],[[424.2,145],[439.7,245]],[[439.7,245],[455.2,195.0]],[[455.2,195.0],[470.7,245]],[[470.7,245],[486.2,145]],[[569.9,145],[607.1,145]],[[607.1,145],[619.5,165.0]],[[619.5,165.0],[619.5,225.0]],[[619.5,225.0],[607.1,245]],[[607.1,245],[569.9,245]],[[569.9,245],[557.5,225.0]],[[557.5,225.0],[557.5,165.0]],[[557.5,165.0],[569.9,145]],[[641.2,245],[641.2,145]],[[641.2,145],[703.2,245]],[[703.2,245],[703.2,145]],[[786.9,145],[724.9,145]],[[724.9,145],[724.9,245]],[[724.9,245],[786.9,245]],[[724.9,195.0],[774.5,195.0]],[[323.45,290],[323.45,390]],[[323.45,390],[385.45,390]],[[438.15,290],[438.15,390]],[[490.85,390],[490.85,290]],[[490.85,290],[552.85,390]],[[552.85,390],[552.85,290]],[[636.55,290],[574.55,290]],[[574.55,290],[574.55,390]],[[574.55,390],[636.55,390]],[[574.55,340.0],[624.15,340.0]]];
export const introStrokes = introPaths.map((points,i)=>({id:`intro-draw-one-line-${i}`,...validate(points,"")}));
export const expectedIDs = ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6", "seed-7", "seed-8", "seed-9", "seed-10", "seed-11", "seed-12", "seed-13", "seed-14", "seed-15", "seed-16", "seed-17", "seed-18", "seed-19", "seed-20", "seed-21", "seed-22", "seed-23", "seed-24", "seed-25", "seed-26", "seed-27", "seed-28", "seed-29", "seed-30", "seed-31", "seed-32", "seed-33", "seed-34", "seed-35", "seed-36", "seed-37", "seed-38", "seed-39", "seed-40", "seed-41", "seed-42", "seed-43", "seed-44", "seed-45", "seed-46", "9d734183-794e-428a-ab4f-8ebfd9f32b5a"];
export async function installIntroOnce(storage) {
  return storage.transaction(async tx => {
    const previous = await tx.get("canvas");
    if (await tx.get("intro-draw-one-line-installed-v1")) return previous;
    // Fail closed when new visitor artwork arrived after the owner's reviewed baseline.
    if (!previous || previous.version !== 1 || previous.strokes.length !== 47 || previous.strokes.some((s,i)=>s.id !== expectedIDs[i])) return previous;
    await tx.put("backup-before-draw-one-line-v1", previous);
    const next = {...previous, version: previous.version + 1, strokes: structuredClone(introStrokes)};
    await tx.put("canvas", next);
    await tx.put("intro-draw-one-line-installed-v1", {version:next.version, count:47});
    return next;
  });
}
