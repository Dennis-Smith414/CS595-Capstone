import { pick } from "@react-native-documents/picker";
import RNFS from "react-native-fs";

export async function pickLocalFileToCache(): Promise<{ fileUri: string; name: string } | null> {
  const [file] = await pick().catch(() => [null]);
  if (!file) return null;

  const destPath = `${RNFS.CachesDirectoryPath}/${file.name}`;
  await RNFS.copyFile(file.uri, destPath);
  return { fileUri: `file://${destPath}`, name: file.name };
}
