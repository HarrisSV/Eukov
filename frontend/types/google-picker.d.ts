export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: "popup" | "redirect";
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
      picker: {
        Action: {
          PICKED: string;
          CANCEL: string;
        };
        ViewId: {
          DOCS: string;
        };
        DocsView: new () => {
          setIncludeFolders: (include: boolean) => unknown;
          setSelectFolderEnabled: (enabled: boolean) => unknown;
        };
        DocsUploadView: new () => unknown;
        PickerBuilder: new () => {
          setAppId: (appId: string) => unknown;
          setDeveloperKey: (key: string) => unknown;
          setOAuthToken: (token: string) => unknown;
          addView: (view: unknown) => unknown;
          setCallback: (
            callback: (data: {
              action: string;
              docs?: Array<{
                id: string;
                name: string;
                mimeType: string;
              }>;
            }) => void,
          ) => unknown;
          build: () => { setVisible: (visible: boolean) => void };
        };
      };
    };
    gapi?: {
      load: (name: string, callback: () => void) => void;
    };
  }
}
