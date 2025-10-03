import React, { useState } from "react";
import { Alert } from "react-native";
import RouteCreateForm from "../components/RouteCreateForm";
import { pickLocalFileToCache } from "../utils/pickLocalFile";
import { patchRouteMeta, uploadGpxFile } from "../services/RoutesApi";

export default function RouteCreateScreen({ navigation }: { navigation: any }) {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickFile = async () => {
    try {
      const picked = await pickLocalFileToCache();
      if (picked) setFileUri(picked.fileUri);
    } catch (e) {
      console.error("File pick failed:", e);
      Alert.alert("Error", "Could not pick GPX file.");
    }
  };

  const onSubmit = async (values: { name: string; region: string }) => {
    if (!values.name || !fileUri) {
      Alert.alert("Missing info", "Please provide a name and GPX file.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) upload the GPX -> returns route id
      const { id } = await uploadGpxFile(fileUri);

      // 2) patch the metadata
      await patchRouteMeta(id, { name: values.name, region: values.region });

      Alert.alert("Success", "Route created!");
      navigation.goBack();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload failed", e?.message ?? "Could not create route.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteCreateForm
      onPickFile={onPickFile}
      onSubmit={({ name, region }) => onSubmit({ name, region })}
      onCancel={() => navigation.goBack()}
      submitting={submitting}
      fileSelected={!!fileUri}
    />
  );
}
