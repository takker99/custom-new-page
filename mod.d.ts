export function isolate(
  ...options: {
    judge: (lines: string[]) => boolean;
    leftText: (
      lines: string[],
      options: { index: number; project: string; title: string },
    ) => string;
    newPages: (
      lines: string[],
      options: { index: number; project: string; title: string },
    ) => {
      project: string;
      title: string;
      body: string;
    }[];
  }[]
): void;
