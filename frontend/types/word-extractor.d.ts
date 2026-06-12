declare module "word-extractor" {
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }

  export interface Document {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
    getTextboxes(): string;
  }
}
