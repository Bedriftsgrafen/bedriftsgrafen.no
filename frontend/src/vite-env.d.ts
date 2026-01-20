/// <reference types="vite/client" />

declare module '*.webp' {
  const value: string;
  export default value;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

interface Window {
  gtag: (
    command: 'config' | 'event' | 'js',
    targetId: string,
    config?: Record<string, unknown>
  ) => void;
  dataLayer: unknown[];
}
