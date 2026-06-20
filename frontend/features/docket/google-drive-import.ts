import { importFileOnClient } from "@/lib/document-import";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const SCRIPT_URLS = [
  "https://accounts.google.com/gsi/client",
  "https://apis.google.com/js/api.js",
] as const;

let scriptsPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadGoogleScripts(): Promise<void> {
  if (!scriptsPromise) {
    scriptsPromise = Promise.all(SCRIPT_URLS.map(loadScript)).then(() => undefined);
  }
  return scriptsPromise;
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("Google API client failed to load"));
      return;
    }
    window.gapi.load("picker", () => resolve());
  });
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID &&
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  );
}

function getGoogleConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

  if (!clientId || !apiKey) {
    throw new Error(
      "Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to your .env file.",
    );
  }

  return { clientId, apiKey, appId };
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google sign-in failed to load"));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? "Google sign-in was cancelled"));
          return;
        }
        resolve(response.access_token);
      },
      ux_mode: "popup",
    });

    client.requestAccessToken({ prompt: "select_account" });
  });
}

function openDrivePicker(
  accessToken: string,
  apiKey: string,
  appId: string | undefined,
): Promise<{ id: string; name: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!window.google?.picker) {
      reject(new Error("Google Picker is unavailable"));
      return;
    }

    const docsView = new window.google.picker.DocsView();
    docsView.setIncludeFolders(true);
    docsView.setSelectFolderEnabled(false);

    const builder = new window.google.picker.PickerBuilder();
    builder.setOAuthToken(accessToken);
    builder.setDeveloperKey(apiKey);
    builder.addView(docsView);
    builder.addView(new window.google.picker.DocsUploadView());
    builder.setCallback(
      (data: {
        action: string;
        docs?: Array<{ id: string; name: string; mimeType: string }>;
      }) => {
        if (data.action === window.google?.picker.Action.CANCEL) {
          reject(new Error("Google Drive picker was cancelled"));
          return;
        }
        if (data.action !== window.google?.picker.Action.PICKED || !data.docs?.[0]) {
          reject(new Error("No file selected from Google Drive"));
          return;
        }
        resolve(data.docs[0]);
      },
    );

    if (appId) {
      builder.setAppId(appId);
    }

    builder.build().setVisible(true);
  });
}

function googleExportTarget(mimeType: string): { mime: string; extension: string } | null {
  switch (mimeType) {
    case "application/vnd.google-apps.document":
      return {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: ".docx",
      };
    case "application/vnd.google-apps.spreadsheet":
      return { mime: "text/csv", extension: ".csv" };
    case "application/vnd.google-apps.presentation":
      return { mime: "application/pdf", extension: ".pdf" };
    default:
      return null;
  }
}

async function downloadDriveFile(
  file: { id: string; name: string; mimeType: string },
  accessToken: string,
): Promise<File> {
  const exportTarget = googleExportTarget(file.mimeType);
  const url = exportTarget
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(exportTarget.mime)}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Could not download the selected Google Drive file.");
  }

  const blob = await response.blob();
  let fileName = file.name;
  if (exportTarget && !fileName.toLowerCase().endsWith(exportTarget.extension)) {
    fileName = `${fileName}${exportTarget.extension}`;
  }

  return new File([blob], fileName, {
    type: exportTarget?.mime ?? (blob.type || "application/octet-stream"),
  });
}

export async function importFromGoogleDrive(): Promise<string> {
  const { clientId, apiKey, appId } = getGoogleConfig();
  await loadGoogleScripts();
  await loadPickerApi();

  const accessToken = await requestAccessToken(clientId);
  const picked = await openDrivePicker(accessToken, apiKey, appId);
  const downloaded = await downloadDriveFile(picked, accessToken);
  return importFileOnClient(downloaded);
}
