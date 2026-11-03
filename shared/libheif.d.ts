declare module "libheif-js" {
  interface Frame {
    get_width(): number;
    get_height(): number;
    free(): void;
    display(
      image: { width: number; height: number; data: Uint8ClampedArray },
      callback: (result: { data: Uint8ClampedArray } | null) => void,
    ): void;
  }
  const lib: { HeifDecoder: new () => { decode(bytes: Uint8Array): Frame[] } };
  export default lib;
}
