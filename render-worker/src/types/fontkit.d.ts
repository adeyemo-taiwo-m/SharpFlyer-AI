declare module "fontkit" {
  type Font = {
    unitsPerEm: number;
    layout(text: string): { advanceWidth: number };
  };

  const fontkit: {
    openSync(path: string): Font;
  };

  export = fontkit;
}
