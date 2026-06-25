declare module "html-to-docx" {
  type HTMLtoDOCX = (
    html: string,
    headerHTML: string | null,
    options?: Record<string, unknown>,
  ) => Promise<Buffer | ArrayBuffer | Blob>;

  const HTMLtoDOCX: HTMLtoDOCX;
  export default HTMLtoDOCX;
}
