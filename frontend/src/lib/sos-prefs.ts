import { storage } from "@/src/utils/storage";

export type SosSoundMode = "loud" | "vibrate" | "silent";

const KEY = "famrak_sos_sound_mode";

export async function getSosSoundMode(): Promise<SosSoundMode> {
  const v = await storage.getItem<string>(KEY, "loud");
  if (v === "loud" || v === "vibrate" || v === "silent") return v;
  return "loud";
}

export async function setSosSoundMode(mode: SosSoundMode) {
  await storage.setItem(KEY, mode);
}
